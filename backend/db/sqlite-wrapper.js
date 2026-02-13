import initSqlJs from 'sql.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

let dbInstance = null;
let dbPath = null;

export async function initDatabase(dbFilePath) {
  dbPath = dbFilePath;
  const SQL = await initSqlJs();
  
  let db;
  if (existsSync(dbFilePath)) {
    const buffer = readFileSync(dbFilePath);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }
  
  dbInstance = db;
  return db;
}

export function getDatabase() {
  if (!dbInstance) {
    throw new Error('Database not initialized. Call initDatabase first.');
  }
  return dbInstance;
}

export function saveDatabase() {
  if (!dbInstance || !dbPath) return;
  const data = dbInstance.export();
  const buffer = Buffer.from(data);
  writeFileSync(dbPath, buffer);
}

// Create a wrapper that mimics better-sqlite3 API
export class Database {
  constructor(filePath) {
    this.filePath = filePath;
    this.db = null;
    this.initPromise = this.init();
  }

  async init() {
    const SQL = await initSqlJs();
    
    if (existsSync(this.filePath)) {
      const buffer = readFileSync(this.filePath);
      this.db = new SQL.Database(buffer);
    } else {
      this.db = new SQL.Database();
    }
  }

  async ready() {
    await this.initPromise;
  }

  exec(sql) {
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    this.db.run(sql);
    this.save();
  }
  
  run(sql) {
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    this.db.run(sql);
    this.save();
  }

  prepare(sql) {
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    return new Statement(this.db, sql, this);
  }

  save() {
    if (!this.db || !this.filePath) return;
    try {
      const data = this.db.export();
      const buffer = Buffer.from(data);
      writeFileSync(this.filePath, buffer);
    } catch (error) {
      console.error('Error saving database:', error);
    }
  }

  close() {
    if (this.db) {
      this.save();
      this.db.close();
    }
  }
}

class Statement {
  constructor(db, sql, parentDb) {
    this.db = db;
    this.sql = sql;
    this.parentDb = parentDb;
    this.stmt = db.prepare(sql);
  }

  get(...params) {
    if (!this.stmt) {
      throw new Error('Statement has been closed');
    }
    try {
      if (params.length > 0) {
        this.stmt.bind(params);
      } else {
        this.stmt.reset();
      }
      if (this.stmt.step()) {
        const result = this.stmt.getAsObject();
        this.stmt.reset();
        return result && Object.keys(result).length > 0 ? result : undefined;
      }
      this.stmt.reset();
      return undefined;
    } catch (error) {
      // If statement is closed, recreate it and retry
      if (error === 'Statement closed' || (typeof error === 'string' && error.includes('Statement closed'))) {
        try {
          this.stmt = this.db.prepare(this.sql);
          if (params.length > 0) {
            this.stmt.bind(params);
          } else {
            this.stmt.reset();
          }
          if (this.stmt.step()) {
            const result = this.stmt.getAsObject();
            this.stmt.reset();
            return result && Object.keys(result).length > 0 ? result : undefined;
          }
          this.stmt.reset();
          return undefined;
        } catch (retryError) {
          throw error; // Throw original error
        }
      }
      throw error;
    }
  }

  all(...params) {
    if (!this.stmt) {
      throw new Error('Statement has been closed');
    }
    try {
      if (params.length > 0) {
        this.stmt.bind(params);
      } else {
        this.stmt.reset();
      }
      const results = [];
      while (this.stmt.step()) {
        results.push(this.stmt.getAsObject());
      }
      this.stmt.reset();
      return results;
    } catch (error) {
      // If statement is closed, recreate it and retry
      if (error === 'Statement closed' || (typeof error === 'string' && error.includes('Statement closed'))) {
        try {
          this.stmt = this.db.prepare(this.sql);
          if (params.length > 0) {
            this.stmt.bind(params);
          } else {
            this.stmt.reset();
          }
          const results = [];
          while (this.stmt.step()) {
            results.push(this.stmt.getAsObject());
          }
          this.stmt.reset();
          return results;
        } catch (retryError) {
          throw error; // Throw original error
        }
      }
      throw error;
    }
  }

  run(...params) {
    if (!this.stmt) {
      throw new Error('Statement has been closed');
    }
    
    try {
      // bind() automatically calls reset(), so we don't need to call it manually
      if (params.length > 0) {
        this.stmt.bind(params);
      } else {
        // If no params, we still need to reset if the statement was used before
        this.stmt.reset();
      }
      this.stmt.step();
      // Reset after step to prepare for next use
      this.stmt.reset();
      
      // Get last insert rowid - prepare a separate statement for this to avoid interference
      let lastInsertRowid = null;
      try {
        // Use a separate prepared statement that we'll free immediately
        const lastInsertStmt = this.db.prepare('SELECT last_insert_rowid() as id');
        if (lastInsertStmt.step()) {
          const result = lastInsertStmt.getAsObject();
          lastInsertRowid = result?.id || null;
        }
        lastInsertStmt.free();
      } catch (e) {
        // Ignore errors - lastInsertRowid will remain null
      }
      
      this.parentDb.save();
      return {
        lastInsertRowid: lastInsertRowid,
        changes: this.db.getRowsModified()
      };
    } catch (error) {
      // If statement is closed, recreate it and retry
      if (error === 'Statement closed' || (typeof error === 'string' && error.includes('Statement closed'))) {
        try {
          this.stmt = this.db.prepare(this.sql);
          if (params.length > 0) {
            this.stmt.bind(params);
          } else {
            this.stmt.reset();
          }
          this.stmt.step();
          this.stmt.reset();
          
          let lastInsertRowid = null;
          try {
            const lastInsertStmt = this.db.prepare('SELECT last_insert_rowid() as id');
            if (lastInsertStmt.step()) {
              const result = lastInsertStmt.getAsObject();
              lastInsertRowid = result?.id || null;
            }
            lastInsertStmt.free();
          } catch (e) {
            // Ignore errors
          }
          
          this.parentDb.save();
          return {
            lastInsertRowid: lastInsertRowid,
            changes: this.db.getRowsModified()
          };
        } catch (retryError) {
          throw error; // Throw original error
        }
      }
      throw error;
    }
  }
}
