import crypto from 'crypto';

export function initDatabase(db) {
  // IP Blocklists (global)
  db.exec(`
    CREATE TABLE IF NOT EXISTS ip_blocklists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      ips TEXT NOT NULL,
      response_code INTEGER DEFAULT 403,
      response_body TEXT DEFAULT '{"error": "IP blocked"}',
      response_type TEXT DEFAULT 'json',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  // Add response_type column if it doesn't exist (for existing databases)
  try {
    db.exec(`ALTER TABLE ip_blocklists ADD COLUMN response_type TEXT DEFAULT 'json'`);
  } catch (e) {
    // Column already exists, ignore
  }

  // IP Allowlists (global)
  db.exec(`
    CREATE TABLE IF NOT EXISTS ip_allowlists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      ips TEXT NOT NULL,
      response_code INTEGER DEFAULT 403,
      response_body TEXT DEFAULT '{"error": "IP not allowed"}',
      response_type TEXT DEFAULT 'json',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  // Add unique constraint to ip_allowlists name
  try {
    db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_ip_allowlists_name ON ip_allowlists(name)`);
  } catch (e) {
    // Index already exists, ignore
  }

  // Key Rate Limits (global)
  db.exec(`
    CREATE TABLE IF NOT EXISTS key_rate_limits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      response_code INTEGER DEFAULT 429,
      response_body TEXT DEFAULT '{"error": "Rate limit exceeded"}',
      response_type TEXT DEFAULT 'json',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  // Add response_type column if it doesn't exist (for existing databases)
  try {
    db.exec(`ALTER TABLE key_rate_limits ADD COLUMN response_type TEXT DEFAULT 'json'`);
  } catch (e) {
    // Column already exists, ignore
  }

  // Rate Limit Rules (multiple per key_rate_limit)
  db.exec(`
    CREATE TABLE IF NOT EXISTS rate_limit_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rate_limit_id INTEGER NOT NULL,
      requests INTEGER NOT NULL,
      window_seconds INTEGER NOT NULL,
      FOREIGN KEY (rate_limit_id) REFERENCES key_rate_limits(id) ON DELETE CASCADE
    )
  `);

  // Projects
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      unique_path TEXT NOT NULL UNIQUE,
      secret_api_key TEXT NOT NULL,
      external_api_url TEXT NOT NULL,
      description TEXT,
      timeout_seconds INTEGER,
      timeout_response_code INTEGER DEFAULT 504,
      timeout_response_body TEXT DEFAULT '{"error": "Request timeout"}',
      timeout_response_type TEXT DEFAULT 'json',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
    )
  `);
  
  // Add account_id column if it doesn't exist
  try {
    db.exec(`ALTER TABLE projects ADD COLUMN account_id INTEGER REFERENCES accounts(id) ON DELETE CASCADE`);
    // Set default account_id for existing projects (if any)
    db.exec(`UPDATE projects SET account_id = 1 WHERE account_id IS NULL`);
  } catch (e) {
    // Column already exists, ignore
  }
  
  // Add timeout and description columns if they don't exist (for existing databases)
  try {
    db.exec(`ALTER TABLE projects ADD COLUMN description TEXT`);
  } catch (e) {
    // Column already exists, ignore
  }
  try {
    db.exec(`ALTER TABLE projects ADD COLUMN timeout_seconds INTEGER`);
  } catch (e) {
    // Column already exists, ignore
  }
  try {
    db.exec(`ALTER TABLE projects ADD COLUMN timeout_response_code INTEGER DEFAULT 504`);
  } catch (e) {
    // Column already exists, ignore
  }
  try {
    db.exec(`ALTER TABLE projects ADD COLUMN timeout_response_body TEXT DEFAULT '{"error": "Request timeout"}'`);
  } catch (e) {
    // Column already exists, ignore
  }
  try {
    db.exec(`ALTER TABLE projects ADD COLUMN timeout_response_type TEXT DEFAULT 'json'`);
  } catch (e) {
    // Column already exists, ignore
  }

  // Endpoint Groups
  db.exec(`
    CREATE TABLE IF NOT EXISTS endpoint_groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    )
  `);
  
  // Add description column if it doesn't exist (for existing databases)
  try {
    db.exec(`ALTER TABLE endpoint_groups ADD COLUMN description TEXT`);
  } catch (e) {
    // Column already exists, ignore
  }

  // Endpoints (URLs in endpoint groups)
  db.exec(`
    CREATE TABLE IF NOT EXISTS endpoints (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      endpoint_group_id INTEGER NOT NULL,
      url_pattern TEXT NOT NULL,
      method TEXT NOT NULL,
      FOREIGN KEY (endpoint_group_id) REFERENCES endpoint_groups(id) ON DELETE CASCADE
    )
  `);

  // System Accounts (for logging into the system)
  db.exec(`
    CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      two_factor_secret TEXT,
      two_factor_enabled INTEGER DEFAULT 0,
      session_timeout_seconds INTEGER DEFAULT 3600,
      log_ip_addresses INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  // Add log_ip_addresses column if it doesn't exist
  try {
    db.exec(`ALTER TABLE accounts ADD COLUMN log_ip_addresses INTEGER DEFAULT 0`);
  } catch (e) {
    // Column already exists, ignore
  }
  
  // Add account_code column if it doesn't exist
  try {
    db.exec(`ALTER TABLE accounts ADD COLUMN account_code TEXT`);
    // Generate default account codes for existing accounts
    const accounts = db.prepare('SELECT id FROM accounts WHERE account_code IS NULL').all();
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    for (const account of accounts) {
      const code = Array.from(crypto.randomBytes(3))
        .map(byte => chars[byte % chars.length])
        .join('');
      db.prepare('UPDATE accounts SET account_code = ? WHERE id = ?').run(code, account.id);
    }
  } catch (e) {
    // Column already exists, ignore
  }

  // Users (for API key assignment - separate from accounts)
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      email TEXT,
      color TEXT NOT NULL DEFAULT '#3b82f6',
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
    )
  `);
  
  // Add account_id column if it doesn't exist
  try {
    db.exec(`ALTER TABLE users ADD COLUMN account_id INTEGER REFERENCES accounts(id) ON DELETE CASCADE`);
    // Set default account_id for existing users (if any)
    db.exec(`UPDATE users SET account_id = 1 WHERE account_id IS NULL`);
  } catch (e) {
    // Column already exists, ignore
  }
  
  // Remove authentication columns from users table if they exist (moved to accounts)
  // These are now in the accounts table, not users table

  // API Keys
  db.exec(`
    CREATE TABLE IF NOT EXISTS api_keys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      key_value TEXT NOT NULL UNIQUE,
      rate_limit_id INTEGER,
      ip_blocklist_id INTEGER,
      ip_allowlist_id INTEGER,
      user_id INTEGER,
      notes TEXT,
      allowed_methods TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (rate_limit_id) REFERENCES key_rate_limits(id),
      FOREIGN KEY (ip_blocklist_id) REFERENCES ip_blocklists(id),
      FOREIGN KEY (ip_allowlist_id) REFERENCES ip_allowlists(id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    )
  `);
  
  // Add ip_allowlist_id column if it doesn't exist (for existing databases)
  try {
    db.exec(`ALTER TABLE api_keys ADD COLUMN ip_allowlist_id INTEGER REFERENCES ip_allowlists(id)`);
  } catch (e) {
    // Column already exists, ignore
  }
  
  // Add user_id column if it doesn't exist (for existing databases)
  try {
    db.exec(`ALTER TABLE api_keys ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE SET NULL`);
  } catch (e) {
    // Column already exists, ignore
  }
  
  // Add name column to api_keys if it doesn't exist
  try {
    db.exec(`ALTER TABLE api_keys ADD COLUMN name TEXT`);
  } catch (e) {
    // Column already exists, ignore
  }
  
  // Add unique constraint to endpoint_groups name per project
  try {
    db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_endpoint_groups_project_name ON endpoint_groups(project_id, name)`);
  } catch (e) {
    // Index already exists, ignore
  }
  
  // Add unique constraint to key_rate_limits name
  try {
    db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_key_rate_limits_name ON key_rate_limits(name)`);
  } catch (e) {
    // Index already exists, ignore
  }
  
  // Add unique constraint to ip_blocklists name
  try {
    db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_ip_blocklists_name ON ip_blocklists(name)`);
  } catch (e) {
    // Index already exists, ignore
  }
  
  // Add unique constraint to users email per account
  try {
    db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_account_email ON users(account_id, email) WHERE email IS NOT NULL AND email != ''`);
  } catch (e) {
    // Index already exists, ignore
  }
  
  // Add unique constraint to api_keys name per account
  try {
    db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_api_keys_name ON api_keys(name) WHERE name IS NOT NULL AND name != ''`);
  } catch (e) {
    // Index already exists, ignore
  }
  
  // Add expiry columns if they don't exist
  try {
    db.exec(`ALTER TABLE api_keys ADD COLUMN expiry_date DATETIME`);
  } catch (e) {
    // Column already exists, ignore
  }
  try {
    db.exec(`ALTER TABLE api_keys ADD COLUMN expiry_usage_limit INTEGER`);
  } catch (e) {
    // Column already exists, ignore
  }
  try {
    db.exec(`ALTER TABLE api_keys ADD COLUMN expiry_response_code INTEGER DEFAULT 403`);
  } catch (e) {
    // Column already exists, ignore
  }
  try {
    db.exec(`ALTER TABLE api_keys ADD COLUMN expiry_response_body TEXT DEFAULT '{"error": "API key expired"}'`);
  } catch (e) {
    // Column already exists, ignore
  }
  try {
    db.exec(`ALTER TABLE api_keys ADD COLUMN expiry_response_type TEXT DEFAULT 'json'`);
  } catch (e) {
    // Column already exists, ignore
  }

  // API Key Endpoint Group Mappings
  db.exec(`
    CREATE TABLE IF NOT EXISTS api_key_endpoint_groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      api_key_id INTEGER NOT NULL,
      endpoint_group_id INTEGER NOT NULL,
      FOREIGN KEY (api_key_id) REFERENCES api_keys(id) ON DELETE CASCADE,
      FOREIGN KEY (endpoint_group_id) REFERENCES endpoint_groups(id) ON DELETE CASCADE,
      UNIQUE(api_key_id, endpoint_group_id)
    )
  `);

  // Request Logs
  db.exec(`
    CREATE TABLE IF NOT EXISTS request_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      api_key_id INTEGER,
      project_id INTEGER NOT NULL,
      method TEXT NOT NULL,
      url TEXT NOT NULL,
      headers TEXT,
      body TEXT,
      response_code INTEGER,
      response_body TEXT,
      ip_address TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (api_key_id) REFERENCES api_keys(id),
      FOREIGN KEY (project_id) REFERENCES projects(id)
    )
  `);

  // Create default rate limit (10 req/sec, 100 req/60 sec)
  const defaultRateLimit = db.prepare('SELECT id FROM key_rate_limits WHERE name = ?').get('Default Rate Limit');
  if (!defaultRateLimit || !defaultRateLimit.id) {
    const insert = db.prepare('INSERT INTO key_rate_limits (name) VALUES (?)');
    const result = insert.run('Default Rate Limit');
    const rateLimitId = result.lastInsertRowid;
    
    const insertRule = db.prepare('INSERT INTO rate_limit_rules (rate_limit_id, requests, window_seconds) VALUES (?, ?, ?)');
    insertRule.run(rateLimitId, 10, 1);
    insertRule.run(rateLimitId, 100, 60);
  }
}
