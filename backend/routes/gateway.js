import express from 'express';
import axios from 'axios';

const router = express.Router();

// Rate limit tracking (in-memory for now, could be moved to Redis in production)
const rateLimitStore = new Map();

function checkRateLimit(apiKeyId, rateLimitId, db) {
  if (!rateLimitId) return true;
  
  const rules = db.prepare('SELECT * FROM rate_limit_rules WHERE rate_limit_id = ? ORDER BY window_seconds ASC').all(rateLimitId);
  const now = Date.now();
  
  if (!rateLimitStore.has(apiKeyId)) {
    rateLimitStore.set(apiKeyId, []);
  }
  
  const requests = rateLimitStore.get(apiKeyId);
  
  // Clean old requests
  const cutoff = now - (Math.max(...rules.map(r => r.window_seconds)) * 1000);
  const filtered = requests.filter(timestamp => timestamp > cutoff);
  rateLimitStore.set(apiKeyId, filtered);
  
  // Check each rule
  for (const rule of rules) {
    const windowStart = now - (rule.window_seconds * 1000);
    const count = filtered.filter(timestamp => timestamp > windowStart).length;
    
    if (count >= rule.requests) {
      return false; // Rate limit exceeded
    }
  }
  
  // Record this request
  filtered.push(now);
  rateLimitStore.set(apiKeyId, filtered);
  
  return true;
}

function checkIPBlocklist(ip, ipBlocklistId, db) {
  if (!ipBlocklistId) return null;
  
  const blocklist = db.prepare('SELECT * FROM ip_blocklists WHERE id = ?').get(ipBlocklistId);
  if (!blocklist) return null;
  
  const ips = blocklist.ips.split('\n').map(line => line.trim()).filter(line => line);
  
  for (const pattern of ips) {
    // Simple pattern matching (supports * wildcard)
    const regexPattern = pattern.replace(/\*/g, '.*').replace(/\./g, '\\.');
    const regex = new RegExp(`^${regexPattern}$`);
    
    if (regex.test(ip)) {
      return blocklist;
    }
  }
  
  return null;
}

function checkIPAllowlist(ip, ipAllowlistId, db) {
  if (!ipAllowlistId) return null;
  
  const allowlist = db.prepare('SELECT * FROM ip_allowlists WHERE id = ?').get(ipAllowlistId);
  if (!allowlist) return null;
  
  const ips = allowlist.ips.split('\n').map(line => line.trim()).filter(line => line);
  
  for (const pattern of ips) {
    // Simple pattern matching (supports * wildcard)
    const regexPattern = pattern.replace(/\*/g, '.*').replace(/\./g, '\\.');
    const regex = new RegExp(`^${regexPattern}$`);
    
    if (regex.test(ip)) {
      return allowlist;
    }
  }
  
  return null;
}

function findAndReplaceKey(data, oldKey, newKey) {
  if (typeof data === 'string') {
    return data.replace(new RegExp(oldKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), newKey);
  } else if (Array.isArray(data)) {
    return data.map(item => findAndReplaceKey(item, oldKey, newKey));
  } else if (data && typeof data === 'object') {
    const result = {};
    for (const [key, value] of Object.entries(data)) {
      if (key === oldKey) {
        result[newKey] = value;
      } else {
        result[key] = findAndReplaceKey(value, oldKey, newKey);
      }
    }
    return result;
  }
  return data;
}

// Gateway route handler - matches project paths
router.all('/:projectPath', async (req, res) => {
  const db = req.app.locals.db;
  const { projectPath } = req.params;
  const ip = req.ip || req.headers['x-forwarded-for']?.split(',')[0] || req.connection?.remoteAddress || 'unknown';
  // Note: IP logging is controlled by account setting, see below
  
  // Find project by unique path
  const project = db.prepare('SELECT * FROM projects WHERE unique_path = ?').get(projectPath);
  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }
  
  // Get account's IP logging preference
  const account = db.prepare('SELECT log_ip_addresses FROM accounts WHERE id = ?').get(project.account_id);
  const shouldLogIP = account && account.log_ip_addresses === 1;
  const logIP = shouldLogIP ? ip : null;
  
  // Extract URL from query params
  const targetUrl = req.query.url;
  if (!targetUrl) {
    return res.status(400).json({ error: 'Missing url parameter' });
  }
  
  // Find API key in headers, body, or query
  let apiKey = null;
  let apiKeyData = null;
  
  // Check headers
  for (const [key, value] of Object.entries(req.headers)) {
    if (value && (value.toString().startsWith('vk-or-pk-') || value.toString().startsWith('um-'))) {
      apiKey = value.toString();
      break;
    }
  }
  
  // Check query params
  if (!apiKey) {
    for (const [key, value] of Object.entries(req.query)) {
      if (value && (value.toString().startsWith('vk-or-pk-') || value.toString().startsWith('um-'))) {
        apiKey = value.toString();
        break;
      }
    }
  }
  
  // Check body
  if (!apiKey && req.body) {
    const bodyStr = JSON.stringify(req.body);
    const keyMatch = bodyStr.match(/(vk-or-pk-|um-)[A-Za-z0-9-]+/);
    if (keyMatch) {
      apiKey = keyMatch[0];
    }
  }
  
  // If no key found, return 483
  if (!apiKey) {
    const logInsert = db.prepare(`
      INSERT INTO request_logs (project_id, method, url, headers, body, response_code, response_body, ip_address)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    logInsert.run(
      project.id,
      req.method,
      targetUrl,
      JSON.stringify(req.headers),
      JSON.stringify(req.body),
      483,
      JSON.stringify({ error: 'API key not found' }),
      logIP
    );
    return res.status(483).json({ error: 'API key not found' });
  }
  
  // Get API key data
  apiKeyData = db.prepare('SELECT * FROM api_keys WHERE key_value = ?').get(apiKey);
  if (!apiKeyData || apiKeyData.project_id !== project.id) {
    const logInsert = db.prepare(`
      INSERT INTO request_logs (api_key_id, project_id, method, url, headers, body, response_code, response_body, ip_address)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    logInsert.run(
      apiKeyData?.id || null,
      project.id,
      req.method,
      targetUrl,
      JSON.stringify(req.headers),
      JSON.stringify(req.body),
      401,
      JSON.stringify({ error: 'Invalid API key' }),
      logIP
    );
    return res.status(401).json({ error: 'Invalid API key' });
  }
  
  // Check IP allowlist (if set, only allow IPs in the list)
  if (apiKeyData.ip_allowlist_id) {
    const allowlist = checkIPAllowlist(ip, apiKeyData.ip_allowlist_id, db);
    if (!allowlist) {
      // IP not in allowlist, block it
      const logInsert = db.prepare(`
        INSERT INTO request_logs (api_key_id, project_id, method, url, headers, body, response_code, response_body, ip_address)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const allowlistData = db.prepare('SELECT * FROM ip_allowlists WHERE id = ?').get(apiKeyData.ip_allowlist_id);
      logInsert.run(
        apiKeyData.id,
        project.id,
        req.method,
        targetUrl,
        JSON.stringify(req.headers),
        JSON.stringify(req.body),
        allowlistData?.response_code || 403,
        allowlistData?.response_body || '{"error": "IP not allowed"}',
        logIP
      );
      return res.status(allowlistData?.response_code || 403).send(allowlistData?.response_body || '{"error": "IP not allowed"}');
    }
  }
  
  // Check IP blocklist (if set and no allowlist, block IPs in the list)
  if (apiKeyData.ip_blocklist_id && !apiKeyData.ip_allowlist_id) {
    const blocklist = checkIPBlocklist(ip, apiKeyData.ip_blocklist_id, db);
    if (blocklist) {
      const logInsert = db.prepare(`
        INSERT INTO request_logs (api_key_id, project_id, method, url, headers, body, response_code, response_body, ip_address)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      logInsert.run(
        apiKeyData.id,
        project.id,
        req.method,
        targetUrl,
        JSON.stringify(req.headers),
        JSON.stringify(req.body),
        blocklist.response_code,
        blocklist.response_body,
        logIP
      );
      return res.status(blocklist.response_code).send(blocklist.response_body);
    }
  }
  
  // Check rate limit
  if (apiKeyData.rate_limit_id) {
    const allowed = checkRateLimit(apiKeyData.id, apiKeyData.rate_limit_id, db);
    if (!allowed) {
      const rateLimit = db.prepare('SELECT * FROM key_rate_limits WHERE id = ?').get(apiKeyData.rate_limit_id);
      const logInsert = db.prepare(`
        INSERT INTO request_logs (api_key_id, project_id, method, url, headers, body, response_code, response_body, ip_address)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      logInsert.run(
        apiKeyData.id,
        project.id,
        req.method,
        targetUrl,
        JSON.stringify(req.headers),
        JSON.stringify(req.body),
        rateLimit.response_code,
        rateLimit.response_body,
        logIP
      );
      return res.status(rateLimit.response_code).send(rateLimit.response_body);
    }
  }
  
  // Check allowed methods
  if (apiKeyData.allowed_methods) {
    const allowedMethods = apiKeyData.allowed_methods.split(',').map(m => m.trim().toUpperCase());
    if (!allowedMethods.includes(req.method.toUpperCase())) {
      const logInsert = db.prepare(`
        INSERT INTO request_logs (api_key_id, project_id, method, url, headers, body, response_code, response_body, ip_address)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      logInsert.run(
        apiKeyData.id,
        project.id,
        req.method,
        targetUrl,
        JSON.stringify(req.headers),
        JSON.stringify(req.body),
        405,
        JSON.stringify({ error: 'Method not allowed' }),
        logIP
      );
      return res.status(405).json({ error: 'Method not allowed' });
    }
  }
  
  // Check endpoint groups
  if (apiKeyData.allowed_methods || true) { // Always check if endpoint groups are restricted
    const allowedGroups = db.prepare(`
      SELECT eg.* FROM endpoint_groups eg
      INNER JOIN api_key_endpoint_groups akeg ON eg.id = akeg.endpoint_group_id
      WHERE akeg.api_key_id = ?
    `).all(apiKeyData.id);
    
    if (allowedGroups.length > 0) {
      // Extract path from target URL
      const urlObj = new URL(targetUrl);
      const path = urlObj.pathname;
      const method = req.method.toUpperCase();
      
      let matched = false;
      for (const group of allowedGroups) {
        const endpoints = db.prepare('SELECT * FROM endpoints WHERE endpoint_group_id = ?').all(group.id);
        for (const endpoint of endpoints) {
          const pattern = endpoint.url_pattern.replace(/\*/g, '.*').replace(/\./g, '\\.');
          const regex = new RegExp(`^${pattern}$`);
          if (regex.test(path) && endpoint.method.toUpperCase() === method) {
            matched = true;
            break;
          }
        }
        if (matched) break;
      }
      
      if (!matched) {
        const logInsert = db.prepare(`
          INSERT INTO request_logs (api_key_id, project_id, method, url, headers, body, response_code, response_body, ip_address)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        logInsert.run(
          apiKeyData.id,
          project.id,
          req.method,
          targetUrl,
          JSON.stringify(req.headers),
          JSON.stringify(req.body),
          403,
          JSON.stringify({ error: 'Endpoint not allowed' }),
          logIP
        );
        return res.status(403).json({ error: 'Endpoint not allowed' });
      }
    }
  }
  
  // Replace API key in headers, body, and query
  const secretKey = project.secret_api_key;
  let headers = { ...req.headers };
  let body = req.body;
  let query = { ...req.query };
  
  // Replace in headers
  for (const [key, value] of Object.entries(headers)) {
    if (value && value.toString().includes(apiKey)) {
      headers[key] = value.toString().replace(apiKey, secretKey);
    }
  }
  
  // Replace in body
  if (body) {
    body = findAndReplaceKey(body, apiKey, secretKey);
  }
  
  // Replace in query
  for (const [key, value] of Object.entries(query)) {
    if (value && value.toString().includes(apiKey)) {
      query[key] = value.toString().replace(apiKey, secretKey);
    }
  }
  
  // Remove url from query for forwarding
  delete query.url;
  
  // Forward request with timeout
  try {
    const timeoutMs = project.timeout_seconds ? project.timeout_seconds * 1000 : undefined;
    
    const config = {
      method: req.method,
      url: targetUrl,
      headers: {
        ...headers,
        'host': undefined,
        'content-type': headers['content-type'] || 'application/json'
      },
      params: query,
      data: body,
      timeout: timeoutMs,
      validateStatus: () => true // Accept all status codes
    };
    
    let response;
    try {
      response = await axios(config);
    } catch (error) {
      // Check if it's a timeout error
      if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
        // Handle timeout with configured response
        const timeoutCode = project.timeout_response_code || 504;
        const timeoutBody = project.timeout_response_body || '{"error": "Request timeout"}';
        const timeoutType = project.timeout_response_type || 'json';
        
        const logInsert = db.prepare(`
          INSERT INTO request_logs (api_key_id, project_id, method, url, headers, body, response_code, response_body, ip_address)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        logInsert.run(
          apiKeyData.id,
          project.id,
          req.method,
          targetUrl,
          JSON.stringify(headers),
          JSON.stringify(body),
          timeoutCode,
          timeoutBody,
          logIP
        );
        
        // Set content type based on response_type
        if (timeoutType === 'json') {
          res.setHeader('Content-Type', 'application/json');
        } else if (timeoutType === 'xml') {
          res.setHeader('Content-Type', 'application/xml');
        } else {
          res.setHeader('Content-Type', 'text/plain');
        }
        
        return res.status(timeoutCode).send(timeoutBody);
      }
      // Re-throw other errors
      throw error;
    }
    
    // Log request
    const logInsert = db.prepare(`
      INSERT INTO request_logs (api_key_id, project_id, method, url, headers, body, response_code, response_body, ip_address)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    logInsert.run(
      apiKeyData.id,
      project.id,
      req.method,
      targetUrl,
      JSON.stringify(headers),
      JSON.stringify(body),
      response.status,
      JSON.stringify(response.data),
      logIP
    );
    
    // Return response
    res.status(response.status).json(response.data);
  } catch (error) {
    const logInsert = db.prepare(`
      INSERT INTO request_logs (api_key_id, project_id, method, url, headers, body, response_code, response_body, ip_address)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    logInsert.run(
      apiKeyData.id,
      project.id,
      req.method,
      targetUrl,
      JSON.stringify(headers),
      JSON.stringify(body),
      500,
      JSON.stringify({ error: error.message }),
      logIP
    );
    
    res.status(500).json({ error: error.message });
  }
});

export { router as gatewayRouter };
