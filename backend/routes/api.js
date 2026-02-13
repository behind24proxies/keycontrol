import express from 'express';
import crypto from 'crypto';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';

const router = express.Router();

// Helper to generate account code (6 lowercase letters/numbers)
function generateAccountCode() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from(crypto.randomBytes(6))
    .map(byte => chars[byte % chars.length])
    .join('');
}

// Helper to generate API key
function generateApiKey(accountCode) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const randomString = Array.from(crypto.randomBytes(46))
    .map(byte => chars[byte % chars.length])
    .join('');
  return `um-${accountCode}-${randomString}`;
}

// IP Blocklists
router.get('/ip-blocklists', (req, res) => {
  const db = req.app.locals.db;
  const blocklists = db.prepare('SELECT * FROM ip_blocklists ORDER BY created_at DESC').all();
  
  // Add usage information for each blocklist
  for (const blocklist of blocklists) {
    const usage = db.prepare(`
      SELECT 
        COUNT(DISTINCT ak.id) as api_key_count,
        COUNT(DISTINCT ak.project_id) as project_count,
        GROUP_CONCAT(DISTINCT p.name) as project_names
      FROM api_keys ak
      LEFT JOIN projects p ON ak.project_id = p.id
      WHERE ak.ip_blocklist_id = ?
    `).get(blocklist.id);
    
    blocklist.usage = {
      api_key_count: usage.api_key_count || 0,
      project_count: usage.project_count || 0,
      project_names: usage.project_names ? usage.project_names.split(',') : []
    };
  }
  
  res.json(blocklists);
});

router.post('/ip-blocklists', (req, res) => {
  const db = req.app.locals.db;
  const { name, ips, response_code, response_body, response_type } = req.body;
  
  // Check for duplicate name
  const existing = db.prepare('SELECT id FROM ip_blocklists WHERE name = ?').get(name);
  if (existing) {
    return res.status(400).json({ error: 'IP blocklist name must be unique' });
  }
  
  // Validate response_type
  const validTypes = ['json', 'text', 'xml'];
  const type = response_type && validTypes.includes(response_type) ? response_type : 'json';
  
  const insert = db.prepare('INSERT INTO ip_blocklists (name, ips, response_code, response_body, response_type) VALUES (?, ?, ?, ?, ?)');
  const result = insert.run(name, ips, response_code || 403, response_body || '{"error": "IP blocked"}', type);
  res.json({ id: result.lastInsertRowid, name, ips, response_code: response_code || 403, response_body: response_body || '{"error": "IP blocked"}', response_type: type });
});

router.put('/ip-blocklists/:id', (req, res) => {
  const db = req.app.locals.db;
  const { id } = req.params;
  const { name, ips, response_code, response_body, response_type } = req.body;
  
  // Check for duplicate name (excluding current)
  const existing = db.prepare('SELECT id FROM ip_blocklists WHERE name = ? AND id != ?').get(name, id);
  if (existing) {
    return res.status(400).json({ error: 'IP blocklist name must be unique' });
  }
  
  // Validate response_type
  const validTypes = ['json', 'text', 'xml'];
  const type = response_type && validTypes.includes(response_type) ? response_type : 'json';
  
  const update = db.prepare('UPDATE ip_blocklists SET name = ?, ips = ?, response_code = ?, response_body = ?, response_type = ? WHERE id = ?');
  update.run(name, ips, response_code, response_body, type, id);
  res.json({ id, name, ips, response_code, response_body, response_type: type });
});

router.get('/ip-blocklists/:id/associated-keys', (req, res) => {
  const db = req.app.locals.db;
  const { id } = req.params;
  
  const associatedKeys = db.prepare(`
    SELECT ak.id, ak.key_value, p.name as project_name, p.id as project_id
    FROM api_keys ak
    LEFT JOIN projects p ON ak.project_id = p.id
    WHERE ak.ip_blocklist_id = ?
  `).all(id);
  
  res.json({ associated_keys: associatedKeys });
});

router.delete('/ip-blocklists/:id', (req, res) => {
  const db = req.app.locals.db;
  const { id } = req.params;
  
  // Get associated API keys with details
  const associatedKeys = db.prepare(`
    SELECT ak.id, ak.key_value, p.name as project_name, p.id as project_id
    FROM api_keys ak
    LEFT JOIN projects p ON ak.project_id = p.id
    WHERE ak.ip_blocklist_id = ?
  `).all(id);
  
  if (associatedKeys.length > 0) {
    return res.status(400).json({ 
      error: `Cannot delete IP blocklist: ${associatedKeys.length} API key(s) are using it.`,
      associated_keys: associatedKeys
    });
  }
  
  const deleteStmt = db.prepare('DELETE FROM ip_blocklists WHERE id = ?');
  deleteStmt.run(id);
  res.json({ success: true });
});

// IP Allowlists
router.get('/ip-allowlists', (req, res) => {
  const db = req.app.locals.db;
  const allowlists = db.prepare('SELECT * FROM ip_allowlists ORDER BY created_at DESC').all();
  
  // Add usage information for each allowlist
  for (const allowlist of allowlists) {
    const usage = db.prepare(`
      SELECT 
        COUNT(DISTINCT ak.id) as api_key_count,
        COUNT(DISTINCT ak.project_id) as project_count,
        GROUP_CONCAT(DISTINCT p.name) as project_names
      FROM api_keys ak
      LEFT JOIN projects p ON ak.project_id = p.id
      WHERE ak.ip_allowlist_id = ?
    `).get(allowlist.id);
    
    allowlist.usage = {
      api_key_count: usage.api_key_count || 0,
      project_count: usage.project_count || 0,
      project_names: usage.project_names ? usage.project_names.split(',') : []
    };
  }
  
  res.json(allowlists);
});

router.post('/ip-allowlists', (req, res) => {
  const db = req.app.locals.db;
  const { name, ips, response_code, response_body, response_type } = req.body;
  
  // Check for duplicate name
  const existing = db.prepare('SELECT id FROM ip_allowlists WHERE name = ?').get(name);
  if (existing) {
    return res.status(400).json({ error: 'IP allowlist name must be unique' });
  }
  
  // Validate response_type
  const validTypes = ['json', 'text', 'xml'];
  const type = response_type && validTypes.includes(response_type) ? response_type : 'json';
  
  const insert = db.prepare('INSERT INTO ip_allowlists (name, ips, response_code, response_body, response_type) VALUES (?, ?, ?, ?, ?)');
  const result = insert.run(name, ips, response_code || 403, response_body || '{"error": "IP not allowed"}', type);
  res.json({ id: result.lastInsertRowid, name, ips, response_code: response_code || 403, response_body: response_body || '{"error": "IP not allowed"}', response_type: type });
});

router.put('/ip-allowlists/:id', (req, res) => {
  const db = req.app.locals.db;
  const { id } = req.params;
  const { name, ips, response_code, response_body, response_type } = req.body;
  
  // Check for duplicate name (excluding current)
  const existing = db.prepare('SELECT id FROM ip_allowlists WHERE name = ? AND id != ?').get(name, id);
  if (existing) {
    return res.status(400).json({ error: 'IP allowlist name must be unique' });
  }
  
  // Validate response_type
  const validTypes = ['json', 'text', 'xml'];
  const type = response_type && validTypes.includes(response_type) ? response_type : 'json';
  
  const update = db.prepare('UPDATE ip_allowlists SET name = ?, ips = ?, response_code = ?, response_body = ?, response_type = ? WHERE id = ?');
  update.run(name, ips, response_code, response_body, type, id);
  res.json({ id, name, ips, response_code, response_body, response_type: type });
});

router.get('/ip-allowlists/:id/associated-keys', (req, res) => {
  const db = req.app.locals.db;
  const { id } = req.params;
  
  const associatedKeys = db.prepare(`
    SELECT ak.id, ak.key_value, p.name as project_name, p.id as project_id
    FROM api_keys ak
    LEFT JOIN projects p ON ak.project_id = p.id
    WHERE ak.ip_allowlist_id = ?
  `).all(id);
  
  res.json({ associated_keys: associatedKeys });
});

router.delete('/ip-allowlists/:id', (req, res) => {
  const db = req.app.locals.db;
  const { id } = req.params;
  
  // Get associated API keys with details
  const associatedKeys = db.prepare(`
    SELECT ak.id, ak.key_value, p.name as project_name, p.id as project_id
    FROM api_keys ak
    LEFT JOIN projects p ON ak.project_id = p.id
    WHERE ak.ip_allowlist_id = ?
  `).all(id);
  
  if (associatedKeys.length > 0) {
    return res.status(400).json({ 
      error: `Cannot delete IP allowlist: ${associatedKeys.length} API key(s) are using it.`,
      associated_keys: associatedKeys
    });
  }
  
  const deleteStmt = db.prepare('DELETE FROM ip_allowlists WHERE id = ?');
  deleteStmt.run(id);
  res.json({ success: true });
});

// Key Rate Limits
router.get('/rate-limits', (req, res) => {
  const db = req.app.locals.db;
  const rateLimits = db.prepare('SELECT * FROM key_rate_limits ORDER BY created_at DESC').all();
  
  for (const rl of rateLimits) {
    rl.rules = db.prepare('SELECT * FROM rate_limit_rules WHERE rate_limit_id = ? ORDER BY window_seconds ASC').all(rl.id);
    
    // Add usage information
    const usage = db.prepare(`
      SELECT 
        COUNT(DISTINCT ak.id) as api_key_count,
        COUNT(DISTINCT ak.project_id) as project_count,
        GROUP_CONCAT(DISTINCT p.name) as project_names
      FROM api_keys ak
      LEFT JOIN projects p ON ak.project_id = p.id
      WHERE ak.rate_limit_id = ?
    `).get(rl.id);
    
    rl.usage = {
      api_key_count: usage.api_key_count || 0,
      project_count: usage.project_count || 0,
      project_names: usage.project_names ? usage.project_names.split(',') : []
    };
  }
  
  res.json(rateLimits);
});

router.post('/rate-limits', (req, res) => {
  const db = req.app.locals.db;
  const { name, rules, response_code, response_body, response_type } = req.body;
  
  // Check for duplicate name
  const existing = db.prepare('SELECT id FROM key_rate_limits WHERE name = ?').get(name);
  if (existing) {
    return res.status(400).json({ error: 'Rate limit name must be unique' });
  }
  
  // Validate response_type
  const validTypes = ['json', 'text', 'xml'];
  const type = response_type && validTypes.includes(response_type) ? response_type : 'json';
  
  const insert = db.prepare('INSERT INTO key_rate_limits (name, response_code, response_body, response_type) VALUES (?, ?, ?, ?)');
  const result = insert.run(name, response_code || 429, response_body || '{"error": "Rate limit exceeded"}', type);
  const rateLimitId = result.lastInsertRowid;
  
  const insertRule = db.prepare('INSERT INTO rate_limit_rules (rate_limit_id, requests, window_seconds) VALUES (?, ?, ?)');
  for (const rule of rules || []) {
    insertRule.run(rateLimitId, rule.requests, rule.window_seconds);
  }
  
  res.json({ id: rateLimitId, name, rules, response_code: response_code || 429, response_body: response_body || '{"error": "Rate limit exceeded"}', response_type: type });
});

router.put('/rate-limits/:id', (req, res) => {
  const db = req.app.locals.db;
  const { id } = req.params;
  const { name, rules, response_code, response_body, response_type } = req.body;
  
  // Check for duplicate name (excluding current)
  const existing = db.prepare('SELECT id FROM key_rate_limits WHERE name = ? AND id != ?').get(name, id);
  if (existing) {
    return res.status(400).json({ error: 'Rate limit name must be unique' });
  }
  
  // Validate response_type
  const validTypes = ['json', 'text', 'xml'];
  const type = response_type && validTypes.includes(response_type) ? response_type : 'json';
  
  const update = db.prepare('UPDATE key_rate_limits SET name = ?, response_code = ?, response_body = ?, response_type = ? WHERE id = ?');
  update.run(name, response_code, response_body, type, id);
  
  // Delete old rules and insert new ones
  const deleteRules = db.prepare('DELETE FROM rate_limit_rules WHERE rate_limit_id = ?');
  deleteRules.run(id);
  
  const insertRule = db.prepare('INSERT INTO rate_limit_rules (rate_limit_id, requests, window_seconds) VALUES (?, ?, ?)');
  for (const rule of rules || []) {
    insertRule.run(id, rule.requests, rule.window_seconds);
  }
  
  res.json({ id, name, rules, response_code, response_body, response_type: type });
});

router.get('/rate-limits/:id/associated-keys', (req, res) => {
  const db = req.app.locals.db;
  const { id } = req.params;
  
  const associatedKeys = db.prepare(`
    SELECT ak.id, ak.key_value, p.name as project_name, p.id as project_id
    FROM api_keys ak
    LEFT JOIN projects p ON ak.project_id = p.id
    WHERE ak.rate_limit_id = ?
  `).all(id);
  
  res.json({ associated_keys: associatedKeys });
});

router.delete('/rate-limits/:id', (req, res) => {
  const db = req.app.locals.db;
  const { id } = req.params;
  
  // Get associated API keys with details
  const associatedKeys = db.prepare(`
    SELECT ak.id, ak.key_value, p.name as project_name, p.id as project_id
    FROM api_keys ak
    LEFT JOIN projects p ON ak.project_id = p.id
    WHERE ak.rate_limit_id = ?
  `).all(id);
  
  if (associatedKeys.length > 0) {
    return res.status(400).json({ 
      error: `Cannot delete rate limit: ${associatedKeys.length} API key(s) are using it.`,
      associated_keys: associatedKeys
    });
  }
  
  const deleteStmt = db.prepare('DELETE FROM key_rate_limits WHERE id = ?');
  deleteStmt.run(id);
  res.json({ success: true });
});

// Projects
router.get('/projects', (req, res) => {
  const db = req.app.locals.db;
  const accountId = req.query.account_id;
  if (!accountId) {
    return res.status(400).json({ error: 'Account ID is required' });
  }
  const projects = db.prepare('SELECT * FROM projects WHERE account_id = ? ORDER BY created_at DESC').all(accountId);
  
  // Add statistics for each project
  for (const project of projects) {
    // API key count
    const apiKeyCount = db.prepare('SELECT COUNT(*) as count FROM api_keys WHERE project_id = ?').get(project.id);
    project.api_key_count = apiKeyCount.count || 0;
    
    // Total API key usage count (from request_logs)
    const usageCount = db.prepare('SELECT COUNT(*) as count FROM request_logs WHERE project_id = ?').get(project.id);
    project.total_usage_count = usageCount.count || 0;
    
    // Last API key used time
    const lastUsed = db.prepare(`
      SELECT MAX(created_at) as last_used 
      FROM request_logs 
      WHERE project_id = ? AND api_key_id IS NOT NULL
    `).get(project.id);
    project.last_api_key_used = lastUsed?.last_used || null;
    
    // Endpoint groups count
    const endpointGroupsCount = db.prepare('SELECT COUNT(*) as count FROM endpoint_groups WHERE project_id = ?').get(project.id);
    project.endpoint_groups_count = endpointGroupsCount.count || 0;
  }
  
  // Map external_api_url to external_api_base_url for consistency
  const mappedProjects = projects.map(p => ({
    ...p,
    external_api_base_url: p.external_api_url
  }));
  res.json(mappedProjects);
});

router.get('/projects/:id', (req, res) => {
  const db = req.app.locals.db;
  const { id } = req.params;
  const accountId = req.query.account_id;
  if (!accountId) {
    return res.status(400).json({ error: 'Account ID is required' });
  }
  const project = db.prepare('SELECT * FROM projects WHERE id = ? AND account_id = ?').get(id, accountId);
  
  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }
  
  // Map external_api_url to external_api_base_url for consistency
  project.external_api_base_url = project.external_api_url;
  
  // Get endpoint groups with endpoints
  const endpointGroups = db.prepare('SELECT * FROM endpoint_groups WHERE project_id = ?').all(id);
  for (const group of endpointGroups) {
    group.endpoints = db.prepare('SELECT * FROM endpoints WHERE endpoint_group_id = ?').all(group.id);
  }
  project.endpoint_groups = endpointGroups;
  
  res.json(project);
});

router.post('/projects', (req, res) => {
  const db = req.app.locals.db;
  const { name, unique_path, secret_api_key, external_api_base_url, external_api_url, description, timeout_seconds, timeout_response_code, timeout_response_body, timeout_response_type, account_id } = req.body;
  const apiUrl = external_api_base_url || external_api_url;
  
  if (!account_id) {
    return res.status(400).json({ error: 'Account ID is required' });
  }
  
  // Check if unique_path already exists (globally across all accounts)
  const existing = db.prepare('SELECT id, name FROM projects WHERE unique_path = ?').get(unique_path);
  if (existing) {
    return res.status(400).json({ 
      error: `Path "${unique_path}" is already in use by project "${existing.name}". Please choose a different path.` 
    });
  }
  
  // Validate response_type
  const validTypes = ['json', 'text', 'xml'];
  const timeoutType = timeout_response_type && validTypes.includes(timeout_response_type) ? timeout_response_type : 'json';
  
  try {
    const insert = db.prepare('INSERT INTO projects (account_id, name, unique_path, secret_api_key, external_api_url, description, timeout_seconds, timeout_response_code, timeout_response_body, timeout_response_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    const result = insert.run(
      account_id,
      name, 
      unique_path, 
      secret_api_key, 
      apiUrl,
      description || null,
      timeout_seconds || null,
      timeout_response_code || 504,
      timeout_response_body || '{"error": "Request timeout"}',
      timeoutType
    );
    res.json({ 
      id: result.lastInsertRowid, 
      name, 
      unique_path, 
      secret_api_key, 
      external_api_base_url: apiUrl,
      description: description || null,
      timeout_seconds: timeout_seconds || null,
      timeout_response_code: timeout_response_code || 504,
      timeout_response_body: timeout_response_body || '{"error": "Request timeout"}',
      timeout_response_type: timeoutType
    });
  } catch (error) {
    if (error.message && error.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ 
        error: `Path "${unique_path}" is already in use. Please choose a different path.` 
      });
    }
    return res.status(500).json({ error: 'Failed to create project' });
  }
});

router.put('/projects/:id', (req, res) => {
  const db = req.app.locals.db;
  const { id } = req.params;
  const { name, unique_path, secret_api_key, external_api_base_url, external_api_url, description, timeout_seconds, timeout_response_code, timeout_response_body, timeout_response_type, account_id } = req.body;
  const apiUrl = external_api_base_url || external_api_url;
  
  if (!account_id) {
    return res.status(400).json({ error: 'Account ID is required' });
  }
  
  // Don't allow changing unique_path
  const project = db.prepare('SELECT unique_path FROM projects WHERE id = ? AND account_id = ?').get(id, account_id);
  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }
  
  // Validate response_type
  const validTypes = ['json', 'text', 'xml'];
  const timeoutType = timeout_response_type && validTypes.includes(timeout_response_type) ? timeout_response_type : 'json';
  
  const update = db.prepare('UPDATE projects SET name = ?, secret_api_key = ?, external_api_url = ?, description = ?, timeout_seconds = ?, timeout_response_code = ?, timeout_response_body = ?, timeout_response_type = ? WHERE id = ?');
  update.run(
    name, 
    secret_api_key, 
    apiUrl, 
    description || null,
    timeout_seconds || null,
    timeout_response_code || 504,
    timeout_response_body || '{"error": "Request timeout"}',
    timeoutType,
    id
  );
  res.json({ 
    id, 
    name, 
    unique_path: project.unique_path, 
    secret_api_key, 
    external_api_base_url: apiUrl,
    description: description || null,
    timeout_seconds: timeout_seconds || null,
    timeout_response_code: timeout_response_code || 504,
    timeout_response_body: timeout_response_body || '{"error": "Request timeout"}',
    timeout_response_type: timeoutType
  });
});

router.delete('/projects/:id', (req, res) => {
  const db = req.app.locals.db;
  const { id } = req.params;
  const accountId = req.query.account_id;
  if (!accountId) {
    return res.status(400).json({ error: 'Account ID is required' });
  }
  const deleteStmt = db.prepare('DELETE FROM projects WHERE id = ? AND account_id = ?');
  deleteStmt.run(id, accountId);
  res.json({ success: true });
});

// Endpoint Groups
router.post('/projects/:projectId/endpoint-groups', (req, res) => {
  const db = req.app.locals.db;
  const { projectId } = req.params;
  const { name, description, endpoints, account_id } = req.body;
  
  if (!account_id) {
    return res.status(400).json({ error: 'Account ID is required' });
  }
  
  // Verify project belongs to account
  const project = db.prepare('SELECT id FROM projects WHERE id = ? AND account_id = ?').get(projectId, account_id);
  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }
  
  // Check for duplicate name in same project
  const existing = db.prepare('SELECT id FROM endpoint_groups WHERE project_id = ? AND name = ?').get(projectId, name);
  if (existing) {
    return res.status(400).json({ error: 'Endpoint group name must be unique within this project' });
  }
  
  const insert = db.prepare('INSERT INTO endpoint_groups (project_id, name, description) VALUES (?, ?, ?)');
  const result = insert.run(projectId, name, description || null);
  const groupId = result.lastInsertRowid;
  
  const insertEndpoint = db.prepare('INSERT INTO endpoints (endpoint_group_id, url_pattern, method) VALUES (?, ?, ?)');
  for (const endpoint of endpoints || []) {
    insertEndpoint.run(groupId, endpoint.url_pattern, endpoint.method);
  }
  
  res.json({ id: groupId, name, description: description || null, endpoints });
});

router.put('/endpoint-groups/:id', (req, res) => {
  const db = req.app.locals.db;
  const { id } = req.params;
  const { name, description, endpoints } = req.body;
  
  // Get project_id for this endpoint group
  const group = db.prepare('SELECT project_id FROM endpoint_groups WHERE id = ?').get(id);
  if (!group) {
    return res.status(404).json({ error: 'Endpoint group not found' });
  }
  
  // Check for duplicate name in same project (excluding current group)
  const existing = db.prepare('SELECT id FROM endpoint_groups WHERE project_id = ? AND name = ? AND id != ?').get(group.project_id, name, id);
  if (existing) {
    return res.status(400).json({ error: 'Endpoint group name must be unique within this project' });
  }
  
  const update = db.prepare('UPDATE endpoint_groups SET name = ?, description = ? WHERE id = ?');
  update.run(name, description || null, id);
  
  // Delete old endpoints and insert new ones
  const deleteEndpoints = db.prepare('DELETE FROM endpoints WHERE endpoint_group_id = ?');
  deleteEndpoints.run(id);
  
  const insertEndpoint = db.prepare('INSERT INTO endpoints (endpoint_group_id, url_pattern, method) VALUES (?, ?, ?)');
  for (const endpoint of endpoints || []) {
    insertEndpoint.run(id, endpoint.url_pattern, endpoint.method);
  }
  
  res.json({ id, name, description: description || null, endpoints });
});

router.get('/endpoint-groups/:id/associated-keys', (req, res) => {
  const db = req.app.locals.db;
  const { id } = req.params;
  
  const associatedKeys = db.prepare(`
    SELECT ak.id, ak.key_value, p.name as project_name, p.id as project_id
    FROM api_keys ak
    INNER JOIN api_key_endpoint_groups akeg ON ak.id = akeg.api_key_id
    LEFT JOIN projects p ON ak.project_id = p.id
    WHERE akeg.endpoint_group_id = ?
  `).all(id);
  
  res.json({ associated_keys: associatedKeys });
});

router.delete('/endpoint-groups/:id', (req, res) => {
  const db = req.app.locals.db;
  const { id } = req.params;
  
  // Get associated API keys with details
  const associatedKeys = db.prepare(`
    SELECT ak.id, ak.key_value, p.name as project_name, p.id as project_id
    FROM api_keys ak
    INNER JOIN api_key_endpoint_groups akeg ON ak.id = akeg.api_key_id
    LEFT JOIN projects p ON ak.project_id = p.id
    WHERE akeg.endpoint_group_id = ?
  `).all(id);
  
  if (associatedKeys.length > 0) {
    return res.status(400).json({ 
      error: `Cannot delete endpoint group: ${associatedKeys.length} API key(s) are using it.`,
      associated_keys: associatedKeys
    });
  }
  
  const deleteStmt = db.prepare('DELETE FROM endpoint_groups WHERE id = ?');
  deleteStmt.run(id);
  res.json({ success: true });
});

// Users
router.get('/users', (req, res) => {
  const db = req.app.locals.db;
  const accountId = req.query.account_id;
  if (!accountId) {
    return res.status(400).json({ error: 'Account ID is required' });
  }
  const users = db.prepare('SELECT * FROM users WHERE account_id = ? ORDER BY created_at DESC').all(accountId);
  res.json(users);
});

router.post('/users', (req, res) => {
  const db = req.app.locals.db;
  const { first_name, last_name, email, color, notes, account_id } = req.body;
  
  if (!account_id) {
    return res.status(400).json({ error: 'Account ID is required' });
  }
  
  // Check for duplicate email in same account (if email provided)
  if (email && email.trim()) {
    const existing = db.prepare('SELECT id FROM users WHERE account_id = ? AND email = ?').get(account_id, email.trim());
    if (existing) {
      return res.status(400).json({ error: 'Email must be unique within your account' });
    }
  }
  
  const insert = db.prepare('INSERT INTO users (account_id, first_name, last_name, email, color, notes) VALUES (?, ?, ?, ?, ?, ?)');
  const result = insert.run(account_id, first_name, last_name, email || null, color || '#3b82f6', notes || null);
  res.json({ id: result.lastInsertRowid, first_name, last_name, email, color: color || '#3b82f6', notes });
});

router.put('/users/:id', (req, res) => {
  const db = req.app.locals.db;
  const { id } = req.params;
  const { first_name, last_name, email, color, notes, account_id } = req.body;
  
  if (!account_id) {
    return res.status(400).json({ error: 'Account ID is required' });
  }
  
  // Check for duplicate email in same account (if email provided and changed)
  if (email && email.trim()) {
    const existing = db.prepare('SELECT id FROM users WHERE account_id = ? AND email = ? AND id != ?').get(account_id, email.trim(), id);
    if (existing) {
      return res.status(400).json({ error: 'Email must be unique within your account' });
    }
  }
  
  const update = db.prepare('UPDATE users SET first_name = ?, last_name = ?, email = ?, color = ?, notes = ? WHERE id = ? AND account_id = ?');
  update.run(first_name, last_name, email || null, color || '#3b82f6', notes || null, id, account_id);
  res.json({ id, first_name, last_name, email, color: color || '#3b82f6', notes });
});

router.get('/users/:id/associated-keys', (req, res) => {
  const db = req.app.locals.db;
  const { id } = req.params;
  
  const associatedKeys = db.prepare(`
    SELECT ak.id, ak.key_value, p.name as project_name, p.id as project_id
    FROM api_keys ak
    LEFT JOIN projects p ON ak.project_id = p.id
    WHERE ak.user_id = ?
  `).all(id);
  
  res.json({ associated_keys: associatedKeys });
});

router.delete('/users/:id', (req, res) => {
  const db = req.app.locals.db;
  const { id } = req.params;
  const accountId = req.query.account_id;
  if (!accountId) {
    return res.status(400).json({ error: 'Account ID is required' });
  }
  
  // Get associated API keys with details
  const associatedKeys = db.prepare(`
    SELECT ak.id, ak.key_value, p.name as project_name, p.id as project_id
    FROM api_keys ak
    LEFT JOIN projects p ON ak.project_id = p.id
    WHERE ak.user_id = ? AND p.account_id = ?
  `).all(id, accountId);
  
  if (associatedKeys.length > 0) {
    return res.status(400).json({ 
      error: `Cannot delete user: ${associatedKeys.length} API key(s) are using this user.`,
      associated_keys: associatedKeys
    });
  }
  
  const deleteStmt = db.prepare('DELETE FROM users WHERE id = ? AND account_id = ?');
  deleteStmt.run(id, accountId);
  res.json({ success: true });
});

// Authentication (Accounts)
router.post('/auth/signup', (req, res) => {
  const db = req.app.locals.db;
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }
  
  if (username.length < 3) {
    return res.status(400).json({ error: 'Username must be at least 3 characters long' });
  }
  
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters long' });
  }
  
  // Check if username already exists
  const existing = db.prepare('SELECT id FROM accounts WHERE username = ?').get(username);
  if (existing) {
    return res.status(400).json({ error: 'Username already exists' });
  }
  
  // Hash password
  const passwordHash = crypto.createHash('sha256').update(password).digest('hex');
  
  // Create account
  const insert = db.prepare('INSERT INTO accounts (username, password_hash) VALUES (?, ?)');
  const result = insert.run(username, passwordHash);
  
  res.json({ 
    success: true, 
    message: 'Account created successfully',
    account: {
      id: result.lastInsertRowid,
      username: username
    }
  });
});

router.post('/auth/login', (req, res) => {
  const db = req.app.locals.db;
  const { username, password, two_factor_code } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }
  
  // Find account
  const account = db.prepare('SELECT * FROM accounts WHERE username = ?').get(username);
  
  if (!account) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }
  
  // Verify password
  const passwordHash = crypto.createHash('sha256').update(password).digest('hex');
  if (account.password_hash !== passwordHash) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }
  
  // Check 2FA if enabled
  if (account.two_factor_enabled === 1) {
    if (!two_factor_code) {
      return res.status(400).json({ 
        error: 'Two-factor authentication code is required',
        requires_2fa: true 
      });
    }
    
    if (!account.two_factor_secret) {
      return res.status(400).json({ error: '2FA is enabled but no secret found' });
    }
    
    // Verify 2FA code
    const verified = speakeasy.totp.verify({
      secret: account.two_factor_secret,
      encoding: 'base32',
      token: two_factor_code,
      window: 2
    });
    
    if (!verified) {
      return res.status(401).json({ error: 'Invalid two-factor authentication code' });
    }
  }
  
  // Return account info (without password hash)
  res.json({
    success: true,
    account: {
      id: account.id,
      username: account.username,
      two_factor_enabled: account.two_factor_enabled === 1,
      session_timeout_seconds: account.session_timeout_seconds || 3600
    }
  });
});

// Account Profile Management
router.get('/account/profile', (req, res) => {
  const db = req.app.locals.db;
  const accountId = req.query.account_id;
  
  if (!accountId) {
    return res.status(401).json({ error: 'Account not authenticated' });
  }
  
  const account = db.prepare('SELECT id, username, two_factor_enabled, session_timeout_seconds, log_ip_addresses, account_code FROM accounts WHERE id = ?').get(accountId);
  
  if (!account) {
    return res.status(404).json({ error: 'Account not found' });
  }
  
  // Generate account code if it doesn't exist
  let accountCode = account.account_code;
  if (!accountCode) {
    accountCode = generateAccountCode();
    db.prepare('UPDATE accounts SET account_code = ? WHERE id = ?').run(accountCode, accountId);
  }
  
  res.json({
    id: account.id,
    username: account.username,
    two_factor_enabled: account.two_factor_enabled === 1,
    session_timeout_seconds: account.session_timeout_seconds || 3600,
    log_ip_addresses: account.log_ip_addresses === 1,
    account_code: accountCode
  });
});

router.put('/account/account-code', (req, res) => {
  const db = req.app.locals.db;
  const { account_id, account_code } = req.body;
  
  if (!account_id || !account_code) {
    return res.status(400).json({ error: 'Account ID and account code are required' });
  }
  
  // Validate account code: only lowercase letters and numbers, 6 characters
  if (!/^[a-z0-9]{6}$/.test(account_code)) {
    return res.status(400).json({ error: 'Account code must be exactly 6 lowercase letters or numbers' });
  }
  
  const account = db.prepare('SELECT id FROM accounts WHERE id = ?').get(account_id);
  if (!account) {
    return res.status(404).json({ error: 'Account not found' });
  }
  
  db.prepare('UPDATE accounts SET account_code = ? WHERE id = ?').run(account_code, account_id);
  res.json({ success: true, account_code });
});

router.post('/account/change-password', (req, res) => {
  const db = req.app.locals.db;
  const { account_id, current_password, new_password } = req.body;
  
  if (!account_id || !current_password || !new_password) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  if (new_password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters long' });
  }
  
  const account = db.prepare('SELECT password_hash FROM accounts WHERE id = ?').get(account_id);
  
  if (!account) {
    return res.status(404).json({ error: 'Account not found' });
  }
  
  // Verify current password
  const currentPasswordHash = crypto.createHash('sha256').update(current_password).digest('hex');
  if (account.password_hash !== currentPasswordHash) {
    return res.status(401).json({ error: 'Current password is incorrect' });
  }
  
  // Hash new password
  const newPasswordHash = crypto.createHash('sha256').update(new_password).digest('hex');
  
  // Update password
  const update = db.prepare('UPDATE accounts SET password_hash = ? WHERE id = ?');
  update.run(newPasswordHash, account_id);
  
  res.json({ success: true, message: 'Password changed successfully' });
});

router.post('/account/two-factor/generate', async (req, res) => {
  const db = req.app.locals.db;
  const { account_id } = req.body;
  
  if (!account_id) {
    return res.status(400).json({ error: 'Account ID is required' });
  }
  
  const account = db.prepare('SELECT username FROM accounts WHERE id = ?').get(account_id);
  
  if (!account) {
    return res.status(404).json({ error: 'Account not found' });
  }
  
  // Generate secret
  const secret = speakeasy.generateSecret({
    name: `KeySplitter (${account.username})`,
    issuer: 'KeySplitter'
  });
  
  // Store temporary secret (not enabled yet)
  const update = db.prepare('UPDATE accounts SET two_factor_secret = ? WHERE id = ?');
  update.run(secret.base32, account_id);
  
  // Generate QR code
  try {
    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);
    res.json({
      secret: secret.base32,
      qr_code: qrCodeUrl,
      otpauth_url: secret.otpauth_url,
      manual_entry_key: secret.base32
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate QR code' });
  }
});

router.post('/account/two-factor/verify', (req, res) => {
  const db = req.app.locals.db;
  const { account_id, token } = req.body;
  
  if (!account_id || !token) {
    return res.status(400).json({ error: 'Account ID and token are required' });
  }
  
  const account = db.prepare('SELECT two_factor_secret FROM accounts WHERE id = ?').get(account_id);
  
  if (!account || !account.two_factor_secret) {
    return res.status(400).json({ error: '2FA secret not found. Please generate a new one.' });
  }
  
  // Verify token
  const verified = speakeasy.totp.verify({
    secret: account.two_factor_secret,
    encoding: 'base32',
    token: token,
    window: 2
  });
  
  if (verified) {
    // Enable 2FA
    const update = db.prepare('UPDATE accounts SET two_factor_enabled = 1 WHERE id = ?');
    update.run(account_id);
    res.json({ success: true, message: '2FA enabled successfully' });
  } else {
    res.status(400).json({ error: 'Invalid verification code' });
  }
});

router.post('/account/two-factor/disable', (req, res) => {
  const db = req.app.locals.db;
  const { account_id } = req.body;
  
  if (!account_id) {
    return res.status(400).json({ error: 'Account ID is required' });
  }
  
  const account = db.prepare('SELECT two_factor_enabled FROM accounts WHERE id = ?').get(account_id);
  
  if (!account || !account.two_factor_enabled) {
    return res.status(400).json({ error: '2FA is not enabled' });
  }
  
  // Disable 2FA (no token verification required)
  const update = db.prepare('UPDATE accounts SET two_factor_enabled = 0, two_factor_secret = NULL WHERE id = ?');
  update.run(account_id);
  
  res.json({ success: true, message: '2FA disabled successfully' });
});

router.put('/account/session-timeout', (req, res) => {
  const db = req.app.locals.db;
  const { account_id, session_timeout_seconds } = req.body;
  
  if (!account_id || !session_timeout_seconds) {
    return res.status(400).json({ error: 'Account ID and session timeout are required' });
  }
  
  if (session_timeout_seconds < 120) {
    return res.status(400).json({ error: 'Session timeout must be at least 120 seconds' });
  }
  
  const update = db.prepare('UPDATE accounts SET session_timeout_seconds = ? WHERE id = ?');
  update.run(session_timeout_seconds, account_id);
  
  res.json({ success: true, session_timeout_seconds });
});

router.put('/account/ip-logging', (req, res) => {
  const db = req.app.locals.db;
  const { account_id, log_ip_addresses } = req.body;
  
  if (!account_id || typeof log_ip_addresses !== 'boolean') {
    return res.status(400).json({ error: 'Account ID and log_ip_addresses are required' });
  }
  
  const update = db.prepare('UPDATE accounts SET log_ip_addresses = ? WHERE id = ?');
  update.run(log_ip_addresses ? 1 : 0, account_id);
  
  res.json({ success: true, log_ip_addresses });
});

// API Keys
router.get('/projects/:projectId/api-keys', (req, res) => {
  const db = req.app.locals.db;
  const { projectId } = req.params;
  const accountId = req.query.account_id;
  if (!accountId) {
    return res.status(400).json({ error: 'Account ID is required' });
  }
  
  // Verify project belongs to account
  const project = db.prepare('SELECT id FROM projects WHERE id = ? AND account_id = ?').get(projectId, accountId);
  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }
  
  const keys = db.prepare('SELECT * FROM api_keys WHERE project_id = ? ORDER BY created_at DESC').all(projectId);
  
  for (const key of keys) {
    // Get user if exists
    if (key.user_id) {
      key.user = db.prepare('SELECT * FROM users WHERE id = ?').get(key.user_id);
    }
    
    // Get usage statistics
    const usageStats = db.prepare(`
      SELECT 
        COUNT(*) as total_usage,
        MAX(created_at) as last_used
      FROM request_logs
      WHERE api_key_id = ?
    `).get(key.id);
    key.total_usage = usageStats?.total_usage || 0;
    key.last_used = usageStats?.last_used || null;
    
    // Get allowed endpoint groups with endpoints
    const endpointGroups = db.prepare(`
      SELECT eg.* FROM endpoint_groups eg
      INNER JOIN api_key_endpoint_groups akeg ON eg.id = akeg.endpoint_group_id
      WHERE akeg.api_key_id = ?
    `).all(key.id);
    for (const group of endpointGroups) {
      group.endpoints = db.prepare('SELECT * FROM endpoints WHERE endpoint_group_id = ?').all(group.id);
    }
    key.allowed_endpoint_groups = endpointGroups;
  }
  
  res.json(keys);
});

router.post('/projects/:projectId/api-keys', (req, res) => {
  const db = req.app.locals.db;
  const { projectId } = req.params;
  const { name, rate_limit_id, ip_blocklist_id, ip_allowlist_id, user_id, notes, allowed_methods, allowed_endpoint_group_ids, expiry_date, expiry_usage_limit, expiry_response_code, expiry_response_body, expiry_response_type, account_id } = req.body;
  
  // Ensure only one of ip_blocklist_id or ip_allowlist_id is set
  if (ip_blocklist_id && ip_allowlist_id) {
    return res.status(400).json({ error: 'API key can only have either an IP blocklist or an IP allowlist, not both' });
  }
  
  if (!account_id) {
    return res.status(400).json({ error: 'Account ID is required' });
  }
  
  // Verify project belongs to account
  const project = db.prepare('SELECT id FROM projects WHERE id = ? AND account_id = ?').get(projectId, account_id);
  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }
  
  // Verify user belongs to account if provided
  if (user_id) {
    const user = db.prepare('SELECT id FROM users WHERE id = ? AND account_id = ?').get(user_id, account_id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
  }
  
  // Validate name uniqueness if provided
  if (name && name.trim()) {
    const existing = db.prepare('SELECT id FROM api_keys WHERE name = ?').get(name.trim());
    if (existing) {
      return res.status(400).json({ error: 'API key name must be unique' });
    }
  }
  
  // Validate required fields
  if (!allowed_methods || (Array.isArray(allowed_methods) && allowed_methods.length === 0) || (typeof allowed_methods === 'string' && !allowed_methods.trim())) {
    return res.status(400).json({ error: 'At least one allowed method must be selected' });
  }
  
  if (!allowed_endpoint_group_ids || !Array.isArray(allowed_endpoint_group_ids) || allowed_endpoint_group_ids.length === 0) {
    return res.status(400).json({ error: 'At least one allowed endpoint group must be selected' });
  }
  
  // Get account code
  const account = db.prepare('SELECT account_code FROM accounts WHERE id = ?').get(account_id);
  if (!account) {
    return res.status(404).json({ error: 'Account not found' });
  }
  
  // Generate account code if it doesn't exist
  let accountCode = account.account_code;
  if (!accountCode) {
    accountCode = generateAccountCode();
    db.prepare('UPDATE accounts SET account_code = ? WHERE id = ?').run(accountCode, account_id);
  }
  
  const keyValue = generateApiKey(accountCode);
  const methodsStr = Array.isArray(allowed_methods) ? allowed_methods.join(',') : allowed_methods;
  
  const insert = db.prepare(`
    INSERT INTO api_keys (project_id, name, key_value, rate_limit_id, ip_blocklist_id, ip_allowlist_id, user_id, notes, allowed_methods, expiry_date, expiry_usage_limit, expiry_response_code, expiry_response_body, expiry_response_type)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const result = insert.run(
    projectId,
    name && name.trim() ? name.trim() : null,
    keyValue, 
    rate_limit_id || null, 
    ip_blocklist_id || null,
    ip_allowlist_id || null,
    user_id || null, 
    notes || null, 
    methodsStr,
    expiry_date || null,
    expiry_usage_limit || null,
    expiry_response_code || 403,
    expiry_response_body || '{"error": "API key expired"}',
    expiry_response_type || 'json'
  );
  
  // Insert endpoint group mappings
  const insertMapping = db.prepare('INSERT INTO api_key_endpoint_groups (api_key_id, endpoint_group_id) VALUES (?, ?)');
  for (const groupId of allowed_endpoint_group_ids) {
    insertMapping.run(result.lastInsertRowid, groupId);
  }
  
  res.json({ id: result.lastInsertRowid, key_value: keyValue, ...req.body });
});

router.put('/api-keys/:id', (req, res) => {
  const db = req.app.locals.db;
  const { id } = req.params;
  const { name, rate_limit_id, ip_blocklist_id, ip_allowlist_id, user_id, notes, allowed_methods, allowed_endpoint_group_ids, expiry_date, expiry_usage_limit, expiry_response_code, expiry_response_body, expiry_response_type } = req.body;
  
  // Ensure only one of ip_blocklist_id or ip_allowlist_id is set
  if (ip_blocklist_id && ip_allowlist_id) {
    return res.status(400).json({ error: 'API key can only have either an IP blocklist or an IP allowlist, not both' });
  }
  
  // Validate name uniqueness if provided and changed
  if (name && name.trim()) {
    const existing = db.prepare('SELECT id FROM api_keys WHERE name = ? AND id != ?').get(name.trim(), id);
    if (existing) {
      return res.status(400).json({ error: 'API key name must be unique' });
    }
  }
  
  // Validate required fields
  if (!allowed_methods || (Array.isArray(allowed_methods) && allowed_methods.length === 0) || (typeof allowed_methods === 'string' && !allowed_methods.trim())) {
    return res.status(400).json({ error: 'At least one allowed method must be selected' });
  }
  
  if (!allowed_endpoint_group_ids || !Array.isArray(allowed_endpoint_group_ids) || allowed_endpoint_group_ids.length === 0) {
    return res.status(400).json({ error: 'At least one allowed endpoint group must be selected' });
  }
  
  const methodsStr = Array.isArray(allowed_methods) ? allowed_methods.join(',') : allowed_methods;
  
  const update = db.prepare(`
    UPDATE api_keys SET name = ?, rate_limit_id = ?, ip_blocklist_id = ?, ip_allowlist_id = ?, user_id = ?, notes = ?, allowed_methods = ?, 
    expiry_date = ?, expiry_usage_limit = ?, expiry_response_code = ?, expiry_response_body = ?, expiry_response_type = ?
    WHERE id = ?
  `);
  update.run(
    name && name.trim() ? name.trim() : null,
    rate_limit_id || null, 
    ip_blocklist_id || null,
    ip_allowlist_id || null,
    user_id || null, 
    notes || null, 
    methodsStr,
    expiry_date || null,
    expiry_usage_limit || null,
    expiry_response_code || 403,
    expiry_response_body || '{"error": "API key expired"}',
    expiry_response_type || 'json',
    id
  );
  
  // Update endpoint group mappings
  const deleteMappings = db.prepare('DELETE FROM api_key_endpoint_groups WHERE api_key_id = ?');
  deleteMappings.run(id);
  
  const insertMapping = db.prepare('INSERT INTO api_key_endpoint_groups (api_key_id, endpoint_group_id) VALUES (?, ?)');
  for (const groupId of allowed_endpoint_group_ids) {
    insertMapping.run(id, groupId);
  }
  
  res.json({ id, ...req.body });
});

router.post('/api-keys/:id/rotate', (req, res) => {
  const db = req.app.locals.db;
  const { id } = req.params;
  const { account_id } = req.body;
  
  if (!account_id) {
    return res.status(400).json({ error: 'Account ID is required' });
  }
  
  // Get the API key and verify it belongs to the account
  const key = db.prepare(`
    SELECT ak.*, p.account_id 
    FROM api_keys ak
    INNER JOIN projects p ON ak.project_id = p.id
    WHERE ak.id = ?
  `).get(id);
  
  if (!key) {
    return res.status(404).json({ error: 'API key not found' });
  }
  
  if (key.account_id !== account_id) {
    return res.status(403).json({ error: 'Unauthorized' });
  }
  
  // Get account code
  const account = db.prepare('SELECT account_code FROM accounts WHERE id = ?').get(account_id);
  if (!account) {
    return res.status(404).json({ error: 'Account not found' });
  }
  
  // Generate account code if it doesn't exist
  let accountCode = account.account_code;
  if (!accountCode) {
    accountCode = generateAccountCode();
    db.prepare('UPDATE accounts SET account_code = ? WHERE id = ?').run(accountCode, account_id);
  }
  
  // Generate new key
  const newKeyValue = generateApiKey(accountCode);
  
  // Update the key
  const update = db.prepare('UPDATE api_keys SET key_value = ? WHERE id = ?');
  update.run(newKeyValue, id);
  
  res.json({ id, key_value: newKeyValue });
});

router.delete('/api-keys/:id', (req, res) => {
  const db = req.app.locals.db;
  const { id } = req.params;
  const deleteStmt = db.prepare('DELETE FROM api_keys WHERE id = ?');
  deleteStmt.run(id);
  res.json({ success: true });
});

// Logs
router.get('/logs', (req, res) => {
  const db = req.app.locals.db;
  const { api_key_id, project_id, limit = 100, offset = 0 } = req.query;
  
  let query = 'SELECT * FROM request_logs WHERE 1=1';
  const params = [];
  
  if (api_key_id) {
    query += ' AND api_key_id = ?';
    params.push(api_key_id);
  }
  if (project_id) {
    query += ' AND project_id = ?';
    params.push(project_id);
  }
  
  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), parseInt(offset));
  
  const logs = db.prepare(query).all(...params);
  res.json(logs);
});

export { router as apiRouter };
