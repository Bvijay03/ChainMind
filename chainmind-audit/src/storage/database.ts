import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { config } from "../config.js";
import { logger } from "../utils/logger.js";

let dbInstance: Database.Database | null = null;

export function getDatabase(): Database.Database {
  if (!dbInstance) {
    const dir = path.dirname(config.sqlitePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    dbInstance = new Database(config.sqlitePath);
    dbInstance.pragma("journal_mode = WAL");
    dbInstance.pragma("synchronous = NORMAL");
    
    initSchema(dbInstance);
    logger.info({ path: config.sqlitePath }, "SQLite database initialized successfully");
  }
  return dbInstance;
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS event_log (
      id                  TEXT PRIMARY KEY,
      chain_id            INTEGER NOT NULL,
      tx_hash             TEXT NOT NULL,
      block_number        INTEGER NOT NULL,
      block_timestamp     INTEGER NOT NULL,
      sender              TEXT NOT NULL,
      receiver            TEXT NOT NULL,
      value_wei           TEXT NOT NULL,
      input_data          TEXT,
      function_selector   TEXT,
      
      extracted_intent    TEXT DEFAULT 'UNKNOWN',
      intent_source       TEXT DEFAULT 'PENDING',
      confidence_score    REAL DEFAULT 0.0,
      
      block_confirmations INTEGER DEFAULT 0,
      ingested_at         INTEGER NOT NULL,
      processed_at        INTEGER,
      recon_status        TEXT DEFAULT 'PENDING',
      recon_record_id     TEXT,

      UNIQUE(chain_id, tx_hash)
    );

    CREATE INDEX IF NOT EXISTS idx_event_pending ON event_log(recon_status) WHERE recon_status = 'PENDING';
    CREATE INDEX IF NOT EXISTS idx_event_sender ON event_log(sender, block_timestamp);
    CREATE INDEX IF NOT EXISTS idx_event_receiver ON event_log(receiver, block_timestamp);
    CREATE INDEX IF NOT EXISTS idx_event_tx_hash ON event_log(tx_hash);

    CREATE TABLE IF NOT EXISTS recon_records (
      id                  TEXT PRIMARY KEY,
      event_a_id          TEXT NOT NULL,
      event_b_id          TEXT,
      chain_a_id          INTEGER NOT NULL,
      chain_b_id          INTEGER,
      tx_hash_a           TEXT NOT NULL,
      tx_hash_b           TEXT,
      
      match_type          TEXT NOT NULL,
      status              TEXT NOT NULL,
      match_score         REAL,
      
      sender              TEXT NOT NULL,
      receiver            TEXT NOT NULL,
      value_a_wei         TEXT NOT NULL,
      value_b_wei         TEXT,
      value_delta_wei     TEXT DEFAULT '0',
      timestamp_a         INTEGER NOT NULL,
      timestamp_b         INTEGER,
      timestamp_delta_s   INTEGER,
      intent_a            TEXT,
      intent_b            TEXT,
      
      anchor_tx_hash      TEXT,
      anchor_block        INTEGER,
      anchored_at         INTEGER,
      
      created_at          INTEGER NOT NULL,
      updated_at          INTEGER NOT NULL,
      notes               TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_recon_status ON recon_records(status);
    CREATE INDEX IF NOT EXISTS idx_recon_sender ON recon_records(sender);
    CREATE INDEX IF NOT EXISTS idx_recon_created ON recon_records(created_at);
    CREATE INDEX IF NOT EXISTS idx_recon_unanchored ON recon_records(anchor_tx_hash) WHERE anchor_tx_hash IS NULL;
  `);
}
