function ensureAdminSessionsTable(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS adminSessions (
      id TEXT PRIMARY KEY,
      tokenHash TEXT NOT NULL UNIQUE,
      expiresAt TEXT NOT NULL,
      createdAt TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires ON adminSessions(expiresAt);
  `);
}

module.exports = { ensureAdminSessionsTable };
