function ensureBookingSlotUniqueIndex(database) {
  const duplicate = database.prepare(`
    SELECT barberId, date, time, COUNT(*) AS count
    FROM bookings
    WHERE status NOT IN ('cancelled', 'canceled')
    GROUP BY barberId, date, time
    HAVING COUNT(*) > 1
    LIMIT 1
  `).get();
  if (duplicate) throw new Error(`Não foi possível criar o índice de agendamento: duplicidade encontrada em ${duplicate.barberId}/${duplicate.date}/${duplicate.time}.`);

  database.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_bookings_active_slot
    ON bookings(barberId, date, time)
    WHERE status NOT IN ('cancelled', 'canceled');
  `);
}

module.exports = { ensureBookingSlotUniqueIndex };
