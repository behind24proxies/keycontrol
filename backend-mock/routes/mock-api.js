import express from 'express';
import crypto from 'crypto';

const router = express.Router();

// Generate a random virtual key
function generateVirtualKey() {
  return 'vk_' + crypto.randomBytes(24).toString('hex');
}

// Middleware to get database from app.locals
function getDb(req) {
  return req.app.locals.db;
}

// GET /api/keys - Get all virtual keys
router.get('/keys', async (req, res) => {
  try {
    const db = getDb(req);
    const keys = db.prepare('SELECT * FROM virtual_keys ORDER BY created_at DESC').all();
    res.json({
      success: true,
      data: keys,
      count: keys.length
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/keys - Create a virtual key
router.post('/keys', async (req, res) => {
  try {
    const db = getDb(req);
    const { name, description } = req.body;

    const keyValue = generateVirtualKey();
    const result = db.prepare(`
      INSERT INTO virtual_keys (key_value, name, description)
      VALUES (?, ?, ?)
    `).run(keyValue, name || 'Virtual Key', description || null);

    const key = db.prepare('SELECT * FROM virtual_keys WHERE id = ?').get(result.lastInsertRowid);

    res.status(201).json({
      success: true,
      data: key
    });
  } catch (error) {
    if (error.message.includes('UNIQUE constraint')) {
      return res.status(409).json({ success: false, error: 'Key already exists' });
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/keys/:id - Get a specific virtual key
router.get('/keys/:id', async (req, res) => {
  try {
    const db = getDb(req);
    const key = db.prepare('SELECT * FROM virtual_keys WHERE id = ?').get(parseInt(req.params.id));

    if (!key) {
      return res.status(404).json({ success: false, error: 'Virtual key not found' });
    }

    res.json({
      success: true,
      data: key
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/keys/:id - Update a virtual key
router.put('/keys/:id', async (req, res) => {
  try {
    const db = getDb(req);
    const { name, description } = req.body;

    const key = db.prepare('SELECT * FROM virtual_keys WHERE id = ?').get(parseInt(req.params.id));
    if (!key) {
      return res.status(404).json({ success: false, error: 'Virtual key not found' });
    }

    db.prepare(`
      UPDATE virtual_keys 
      SET name = COALESCE(?, name), description = COALESCE(?, description)
      WHERE id = ?
    `).run(name || key.name, description !== undefined ? description : key.description, parseInt(req.params.id));

    const updatedKey = db.prepare('SELECT * FROM virtual_keys WHERE id = ?').get(parseInt(req.params.id));

    res.json({
      success: true,
      data: updatedKey
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/keys/:id - Delete a virtual key
router.delete('/keys/:id', async (req, res) => {
  try {
    const db = getDb(req);
    const key = db.prepare('SELECT * FROM virtual_keys WHERE id = ?').get(parseInt(req.params.id));

    if (!key) {
      return res.status(404).json({ success: false, error: 'Virtual key not found' });
    }

    db.prepare('DELETE FROM virtual_keys WHERE id = ?').run(parseInt(req.params.id));

    res.json({
      success: true,
      message: 'Virtual key deleted successfully'
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/keys/:id/activate - Activate a key
router.post('/keys/:id/activate', async (req, res) => {
  try {
    const db = getDb(req);
    const result = db.prepare(`
      UPDATE virtual_keys 
      SET is_active = 1 
      WHERE id = ?
    `).run(parseInt(req.params.id));

    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: 'Virtual key not found' });
    }

    res.json({
      success: true,
      message: 'Virtual key activated'
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/keys/:id/deactivate - Deactivate a key
router.post('/keys/:id/deactivate', async (req, res) => {
  try {
    const db = getDb(req);
    const result = db.prepare(`
      UPDATE virtual_keys 
      SET is_active = 0 
      WHERE id = ?
    `).run(parseInt(req.params.id));

    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: 'Virtual key not found' });
    }

    res.json({
      success: true,
      message: 'Virtual key deactivated'
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/users - Get all users
router.get('/users', async (req, res) => {
  try {
    const db = getDb(req);
    const users = db.prepare('SELECT * FROM mock_users ORDER BY created_at DESC').all();
    res.json({
      success: true,
      data: users,
      count: users.length
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/users - Create a user
router.post('/users', async (req, res) => {
  try {
    const db = getDb(req);
    const { username, email, first_name, last_name } = req.body;

    if (!username) {
      return res.status(400).json({ success: false, error: 'username is required' });
    }

    const result = db.prepare(`
      INSERT INTO mock_users (username, email, first_name, last_name)
      VALUES (?, ?, ?, ?)
    `).run(username, email || null, first_name || null, last_name || null);

    const user = db.prepare('SELECT * FROM mock_users WHERE id = ?').get(result.lastInsertRowid);

    res.status(201).json({
      success: true,
      data: user
    });
  } catch (error) {
    if (error.message.includes('UNIQUE constraint')) {
      return res.status(409).json({ success: false, error: 'Username already exists' });
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/projects - Get all projects
router.get('/projects', async (req, res) => {
  try {
    const db = getDb(req);
    const projects = db.prepare('SELECT * FROM mock_projects ORDER BY created_at DESC').all();
    res.json({
      success: true,
      data: projects,
      count: projects.length
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/projects - Create a project
router.post('/projects', async (req, res) => {
  try {
    const db = getDb(req);
    const { name, description, status } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, error: 'name is required' });
    }

    const result = db.prepare(`
      INSERT INTO mock_projects (name, description, status)
      VALUES (?, ?, ?)
    `).run(name, description || null, status || 'active');

    const project = db.prepare('SELECT * FROM mock_projects WHERE id = ?').get(result.lastInsertRowid);

    res.status(201).json({
      success: true,
      data: project
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/stats - Get statistics
router.get('/stats', async (req, res) => {
  try {
    const db = getDb(req);
    const totalKeys = db.prepare('SELECT COUNT(*) as count FROM virtual_keys').get();
    const activeKeys = db.prepare('SELECT COUNT(*) as count FROM virtual_keys WHERE is_active = 1').get();
    const totalUsers = db.prepare('SELECT COUNT(*) as count FROM mock_users').get();
    const totalProjects = db.prepare('SELECT COUNT(*) as count FROM mock_projects').get();
    const totalLogs = db.prepare('SELECT COUNT(*) as count FROM api_logs').get();
    const totalMasterKeys = db.prepare('SELECT COUNT(*) as count FROM master_api_keys WHERE is_active = 1').get();

    res.json({
      success: true,
      data: {
        virtual_keys: {
          total: totalKeys.count,
          active: activeKeys.count,
          inactive: totalKeys.count - activeKeys.count
        },
        users: {
          total: totalUsers.count
        },
        projects: {
          total: totalProjects.count
        },
        api_logs: {
          total: totalLogs.count
        },
        master_keys: {
          active: totalMasterKeys.count
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/validate - Validate a key
router.post('/validate', async (req, res) => {
  try {
    const db = getDb(req);
    const { key_value } = req.body;

    if (!key_value) {
      return res.status(400).json({ success: false, error: 'key_value is required' });
    }

    const key = db.prepare('SELECT * FROM virtual_keys WHERE key_value = ?').get(key_value);

    if (!key) {
      return res.status(401).json({ success: false, valid: false, error: 'Invalid key' });
    }

    if (!key.is_active) {
      return res.status(403).json({ success: false, valid: false, error: 'Key is inactive' });
    }

    // Update usage count and last used
    db.prepare(`
      UPDATE virtual_keys 
      SET usage_count = usage_count + 1, last_used_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(key.id);

    // Log the request
    const startTime = Date.now();
    const responseTime = Date.now() - startTime;
    db.prepare(`
      INSERT INTO api_logs (virtual_key_id, endpoint, method, status_code, response_time_ms, ip_address)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(key.id, '/api/validate', 'POST', 200, responseTime, req.ip || 'unknown');

    res.json({
      success: true,
      valid: true,
      data: {
        id: key.id,
        name: key.name,
        usage_count: key.usage_count + 1,
        created_at: key.created_at
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export { router as mockApiRouter };
