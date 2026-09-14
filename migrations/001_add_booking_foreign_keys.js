function tableHasForeignKey(database, tableName) {
  return database.prepare(`PRAGMA foreign_key_list("${tableName}")`).all().length > 0;
}

function assertNoOrphans(database) {
  const orphanBookingServices = database.prepare(`
    SELECT COUNT(*) AS count
    FROM bookings AS bookings
    LEFT JOIN services AS services ON services.id = bookings.serviceId
    WHERE services.id IS NULL
  `).get().count;
  const orphanBookingBarbers = database.prepare(`
    SELECT COUNT(*) AS count
    FROM bookings AS bookings
    LEFT JOIN barbers AS barbers ON barbers.id = bookings.barberId
    WHERE barbers.id IS NULL
  `).get().count;
  const orphanBlockedBarbers = database.prepare(`
    SELECT COUNT(*) AS count
    FROM blockedSlots AS blocked
    LEFT JOIN barbers AS barbers ON barbers.id = blocked.barberId
    WHERE barbers.id IS NULL
  `).get().count;

  if (orphanBookingServices || orphanBookingBarbers || orphanBlockedBarbers) {
    throw new Error(`Não foi possível adicionar foreign keys: ${orphanBookingServices + orphanBookingBarbers + orphanBlockedBarbers} registro(s) órfão(s).`);
  }
}

function assertCounts(database, expectedCounts) {
  for (const [tableName, expected] of Object.entries(expectedCounts)) {
    const actual = database.prepare(`SELECT COUNT(*) AS count FROM "${tableName}"`).get().count;
    if (actual !== expected) throw new Error(`Contagem alterada em ${tableName}: esperado ${expected}, obtido ${actual}.`);
  }
}

function migrate(database) {
  const needsMigration = !tableHasForeignKey(database, 'bookings') || !tableHasForeignKey(database, 'blockedSlots');
  if (!needsMigration) return false;

  assertNoOrphans(database);
  const expectedCounts = {
    barbers: database.prepare('SELECT COUNT(*) AS count FROM barbers').get().count,
    services: database.prepare('SELECT COUNT(*) AS count FROM services').get().count,
    bookings: database.prepare('SELECT COUNT(*) AS count FROM bookings').get().count,
    blockedSlots: database.prepare('SELECT COUNT(*) AS count FROM blockedSlots').get().count
  };

  database.exec('PRAGMA foreign_keys = OFF');
  database.exec('BEGIN IMMEDIATE');
  try {
    database.exec(`
      CREATE TABLE barbers_new (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        role TEXT NOT NULL,
        initials TEXT NOT NULL,
        workDays TEXT NOT NULL,
        start TEXT NOT NULL,
        end TEXT NOT NULL,
        workPeriods TEXT NOT NULL,
        active INTEGER NOT NULL DEFAULT 1,
        commissionPercent REAL NOT NULL DEFAULT 40.0
      );
      CREATE TABLE services_new (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        duration INTEGER NOT NULL,
        price REAL NOT NULL,
        icon TEXT NOT NULL,
        active INTEGER NOT NULL DEFAULT 1
      );
      CREATE TABLE bookings_new (
        id TEXT PRIMARY KEY,
        code TEXT NOT NULL,
        serviceId TEXT NOT NULL,
        barberId TEXT NOT NULL,
        date TEXT NOT NULL,
        time TEXT NOT NULL,
        duration INTEGER NOT NULL,
        price REAL NOT NULL,
        name TEXT NOT NULL,
        phone TEXT NOT NULL,
        notes TEXT,
        status TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        paymentMethod TEXT NOT NULL DEFAULT 'pix',
        paymentStatus TEXT NOT NULL DEFAULT 'pending',
        FOREIGN KEY(serviceId) REFERENCES services(id) ON UPDATE CASCADE ON DELETE RESTRICT,
        FOREIGN KEY(barberId) REFERENCES barbers(id) ON UPDATE CASCADE ON DELETE RESTRICT
      );
      CREATE TABLE blockedSlots_new (
        id TEXT PRIMARY KEY,
        date TEXT NOT NULL,
        time TEXT NOT NULL,
        barberId TEXT NOT NULL,
        duration INTEGER NOT NULL,
        reason TEXT NOT NULL,
        FOREIGN KEY(barberId) REFERENCES barbers(id) ON UPDATE CASCADE ON DELETE RESTRICT
      );
      INSERT INTO barbers_new SELECT id, name, role, initials, workDays, start, end, workPeriods, active, commissionPercent FROM barbers;
      INSERT INTO services_new SELECT id, name, description, duration, price, icon, active FROM services;
      INSERT INTO bookings_new SELECT id, code, serviceId, barberId, date, time, duration, price, name, phone, notes, status, createdAt, paymentMethod, paymentStatus FROM bookings;
      INSERT INTO blockedSlots_new SELECT id, date, time, barberId, duration, reason FROM blockedSlots;
      DROP TABLE blockedSlots;
      DROP TABLE bookings;
      DROP TABLE services;
      DROP TABLE barbers;
      ALTER TABLE barbers_new RENAME TO barbers;
      ALTER TABLE services_new RENAME TO services;
      ALTER TABLE bookings_new RENAME TO bookings;
      ALTER TABLE blockedSlots_new RENAME TO blockedSlots;
    `);

    assertCounts(database, expectedCounts);
    if (database.prepare('PRAGMA integrity_check').get().integrity_check !== 'ok') throw new Error('integrity_check falhou durante a migration.');
    if (database.prepare('PRAGMA foreign_key_check').all().length) throw new Error('foreign_key_check encontrou inconsistências durante a migration.');
    database.exec('COMMIT');
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  } finally {
    database.exec('PRAGMA foreign_keys = ON');
  }

  return true;
}

module.exports = { migrate };
