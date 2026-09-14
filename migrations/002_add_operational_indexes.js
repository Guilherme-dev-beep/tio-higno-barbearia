function ensureIndexes(database) {
  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_bookings_date_barber ON bookings(date, barberId);
    CREATE INDEX IF NOT EXISTS idx_bookings_barber_date_time ON bookings(barberId, date, time);
    CREATE INDEX IF NOT EXISTS idx_bookings_phone ON bookings(phone);
    CREATE INDEX IF NOT EXISTS idx_blocked_slots_barber_date_time ON blockedSlots(barberId, date, time);
  `);
}

module.exports = { ensureIndexes };
