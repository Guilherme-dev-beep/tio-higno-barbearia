const fs = require('fs');
const path = require('path');

const root = __dirname;
const databasePath = path.resolve(process.env.DATABASE_PATH || path.join(root, 'data', 'tio_higno.sqlite'));

fs.mkdirSync(path.dirname(databasePath), { recursive: true });

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 3000),
  databasePath,
  appTimezone: process.env.APP_TIMEZONE || 'America/Sao_Paulo',
  root
};

module.exports = { env };
