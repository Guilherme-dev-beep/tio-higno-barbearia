const { DatabaseSync } = require('node:sqlite');
const { env } = require('../config');

const database = new DatabaseSync(env.databasePath, { readOnly: true });
try {
  database.exec('PRAGMA foreign_keys = ON');
  const integrity = database.prepare('PRAGMA integrity_check').get().integrity_check;
  const quick = database.prepare('PRAGMA quick_check').get().quick_check;
  const foreignKeys = database.prepare('PRAGMA foreign_key_check').all();
  const journalMode = database.prepare('PRAGMA journal_mode').get().journal_mode;

  console.log(`database=${env.databasePath}`);
  console.log(`integrity_check=${integrity}`);
  console.log(`quick_check=${quick}`);
  console.log(`foreign_key_check=${foreignKeys.length ? JSON.stringify(foreignKeys) : 'ok'}`);
  console.log(`journal_mode=${journalMode}`);

  if (integrity !== 'ok' || quick !== 'ok' || foreignKeys.length) process.exitCode = 1;
} finally {
  database.close();
}
