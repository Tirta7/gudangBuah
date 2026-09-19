import http from "http";
import app from "./app";
import { logger } from "./lib/logger";
import { setupWebSocket } from "./lib/websocket";
import { startScheduler } from "./lib/scheduler";
import { pool } from "@workspace/db";

const rawPort = process.env["PORT"] || "3001";
const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// Pastikan tabel user_sessions ada sebelum server mulai
// connect-pg-simple memerlukan tabel ini agar session bisa disimpan ke PostgreSQL
async function ensureSessionTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_sessions (
        sid  VARCHAR NOT NULL COLLATE "default",
        sess JSON    NOT NULL,
        expire TIMESTAMP(6) NOT NULL,
        CONSTRAINT "session_pkey" PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE
      ) WITH (OIDS=FALSE);
      CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON user_sessions (expire);
    `);
    logger.info("Session table ready");
  } catch (err) {
    // Tabel mungkin sudah ada dengan collation berbeda — abaikan, server tetap jalan
    logger.warn({ err }, "Could not ensure session table — using memory store fallback");
  }
}

const server = http.createServer(app);
setupWebSocket(server);
startScheduler();

// Tunggu tabel session siap baru listen
ensureSessionTable().finally(() => {
  server.listen(port, () => {
    logger.info({ port }, "Server listening with WebSocket support");
  });
});
