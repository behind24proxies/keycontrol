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
    if (params.length > 0) {
      this.stmt.bind(params);
    }
    if (this.stmt.step()) {
      const result = this.stmt.getAsObject();
      this.stmt.reset();
      return result && Object.keys(result).length > 0 ? result : undefined;
    }
    this.stmt.reset();
    return undefined;
  }

  all(...params) {
    if (params.length > 0) {
      this.stmt.bind(params);
    }
    const results = [];
    while (this.stmt.step()) {
      results.push(this.stmt.getAsObject());
    }
    this.stmt.reset();
    return results;
  }

  run(...params) {
    if (params.length > 0) {
      this.stmt.bind(params);
    }
    this.stmt.step();
    this.stmt.reset();
    
    // Get last insert rowid
    let lastInsertRowid = null;
    try {
      const lastInsertStmt = this.db.prepare('SELECT last_insert_rowid() as id');
      if (lastInsertStmt.step()) {
        const lastInsertResult = lastInsertStmt.getAsObject();
        lastInsertRowid = lastInsertResult?.id || null;
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
  }
}
