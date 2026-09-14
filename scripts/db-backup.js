const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const { env } = require('../config');

const backupDirectory = path.join(env.root, 'backups');
const pad = value => String(value).padStart(2, '0');
const now = new Date();
const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
const destination = path.join(backupDirectory, `tio-higno-${stamp}.sqlite`);

fs.mkdirSync(backupDirectory, { recursive: true });
if (fs.existsSync(destination)) throw new Error(`Backup já existe: ${destination}`);

const database = new DatabaseSync(env.databasePath);
try {
  const escapedDestination = destination.replaceAll("'", "''");
  database.exec('PRAGMA busy_timeout = 5000');
  database.exec(`VACUUM INTO '${escapedDestination}'`);
  console.log(`Backup criado: ${destination}`);
} finally {
  database.close();
}
