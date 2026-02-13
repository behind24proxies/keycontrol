import express from 'express';
import crypto from 'crypto';

const router = express.Router();

// Generate a random API key
function generateApiKey() {
  return 'sk_' + crypto.randomBytes(32).toString('hex');
}

// Middleware to get database from app.locals
function getDb(req) {
  return req.app.locals.db;
}

// POST /api/master-key - Create master API key
router.post('/', async (req, res) => {
  try {
    const db = getDb(req);
    const { name } = req.body;

    const keyValue = generateApiKey();
    const result = db.prepare(`
      INSERT INTO master_api_keys (key_value, name)
      VALUES (?, ?)
    `).run(keyValue, name || 'Master Key');

    const key = db.prepare('SELECT * FROM master_api_keys WHERE id = ?').get(result.lastInsertRowid);

    res.status(201).json({
      success: true,
      data: {
        id: key.id,
        key_value: key.key_value,
        name: key.name,
        created_at: key.created_at,
        is_active: key.is_active
      }
    });
  } catch (error) {
    if (error.message.includes('UNIQUE constraint')) {
      return res.status(409).json({ success: false, error: 'Master key already exists' });
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/master-key - Get master key (masked)
router.get('/', async (req, res) => {
  try {
    const db = getDb(req);
    const keys = db.prepare('SELECT * FROM master_api_keys WHERE is_active = 1 ORDER BY created_at DESC').all();

    const maskedKeys = keys.map(key => ({
      id: key.id,
      key_value: key.key_value.substring(0, 8) + '...' + key.key_value.substring(key.key_value.length - 4),
      name: key.name,
      created_at: key.created_at,
      last_used_at: key.last_used_at,
      is_active: key.is_active
    }));

    res.json({
      success: true,
      data: maskedKeys
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/master-key/:id - Get specific master key (full)
router.get('/:id', async (req, res) => {
  try {
    const db = getDb(req);
    const key = db.prepare('SELECT * FROM master_api_keys WHERE id = ?').get(parseInt(req.params.id));

    if (!key) {
      return res.status(404).json({ success: false, error: 'Master key not found' });
    }

    res.json({
      success: true,
      data: key
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/master-key/:id/regenerate - Regenerate master key
router.put('/:id/regenerate', async (req, res) => {
  try {
    const db = getDb(req);
    const key = db.prepare('SELECT * FROM master_api_keys WHERE id = ?').get(parseInt(req.params.id));

    if (!key) {
      return res.status(404).json({ success: false, error: 'Master key not found' });
    }

    const newKeyValue = generateApiKey();
    db.prepare(`
      UPDATE master_api_keys 
      SET key_value = ?, last_used_at = NULL
      WHERE id = ?
    `).run(newKeyValue, parseInt(req.params.id));

    const updatedKey = db.prepare('SELECT * FROM master_api_keys WHERE id = ?').get(parseInt(req.params.id));

    res.json({
      success: true,
      data: updatedKey,
      message: 'Master key regenerated successfully'
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/master-key/regenerate - Regenerate all active master keys
router.put('/regenerate', async (req, res) => {
  try {
    const db = getDb(req);
    const keys = db.prepare('SELECT * FROM master_api_keys WHERE is_active = 1').all();

    if (keys.length === 0) {
      return res.status(404).json({ success: false, error: 'No active master keys found' });
    }

    const newKeys = [];
    for (const key of keys) {
      const newKeyValue = generateApiKey();
      db.prepare(`
        UPDATE master_api_keys 
        SET key_value = ?, last_used_at = NULL
        WHERE id = ?
      `).run(newKeyValue, key.id);
      
      const updatedKey = db.prepare('SELECT * FROM master_api_keys WHERE id = ?').get(key.id);
      newKeys.push(updatedKey);
    }

    res.json({
      success: true,
      data: newKeys,
      message: `Regenerated ${newKeys.length} master key(s)`
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/master-key/:id - Delete master key
router.delete('/:id', async (req, res) => {
  try {
    const db = getDb(req);
    const key = db.prepare('SELECT * FROM master_api_keys WHERE id = ?').get(parseInt(req.params.id));

    if (!key) {
      return res.status(404).json({ success: false, error: 'Master key not found' });
    }

    db.prepare('DELETE FROM master_api_keys WHERE id = ?').run(parseInt(req.params.id));

    res.json({
      success: true,
      message: 'Master key deleted successfully'
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/master-key/:id/activate - Activate master key
router.put('/:id/activate', async (req, res) => {
  try {
    const db = getDb(req);
    const result = db.prepare(`
      UPDATE master_api_keys 
      SET is_active = 1 
      WHERE id = ?
    `).run(parseInt(req.params.id));

    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: 'Master key not found' });
    }

    res.json({
      success: true,
      message: 'Master key activated'
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/master-key/:id/deactivate - Deactivate master key
router.put('/:id/deactivate', async (req, res) => {
  try {
    const db = getDb(req);
    const result = db.prepare(`
      UPDATE master_api_keys 
      SET is_active = 0 
      WHERE id = ?
    `).run(parseInt(req.params.id));

    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: 'Master key not found' });
    }

    res.json({
      success: true,
      message: 'Master key deactivated'
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/master-key/validate - Validate master key
router.post('/validate', async (req, res) => {
  try {
    const db = getDb(req);
    const { key_value } = req.body;

    if (!key_value) {
      return res.status(400).json({ success: false, error: 'key_value is required' });
    }

    const key = db.prepare('SELECT * FROM master_api_keys WHERE key_value = ? AND is_active = 1').get(key_value);

    if (!key) {
      return res.status(401).json({ success: false, valid: false, error: 'Invalid or inactive master key' });
    }

    // Update last_used_at
    db.prepare('UPDATE master_api_keys SET last_used_at = CURRENT_TIMESTAMP WHERE id = ?').run(key.id);

    res.json({
      success: true,
      valid: true,
      data: {
        id: key.id,
        name: key.name,
        created_at: key.created_at
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export { router as masterKeyRouter };
