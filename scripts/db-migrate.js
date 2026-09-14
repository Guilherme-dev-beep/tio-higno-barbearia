const { DatabaseSync } = require('node:sqlite');
const { migrate: migrateForeignKeys } = require('../migrations/001_add_booking_foreign_keys');
const { ensureIndexes } = require('../migrations/002_add_operational_indexes');
const { ensureAdminSessionsTable } = require('../migrations/003_add_admin_sessions');
const { ensureBookingSlotUniqueIndex } = require('../migrations/004_add_booking_slot_unique_index');
const { env } = require('../config');

const database = new DatabaseSync(env.databasePath);
try {
  const migrated = migrateForeignKeys(database);
  ensureIndexes(database);
  ensureAdminSessionsTable(database);
  ensureBookingSlotUniqueIndex(database);
  database.exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  console.log(migrated ? 'Foreign-key migration applied.' : 'Foreign-key migration already applied.');
  console.log(`Database: ${env.databasePath}`);
} finally {
  database.close();
}
