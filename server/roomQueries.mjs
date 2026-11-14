export const byCode = 'SELECT data, generation, expires_at FROM rooms WHERE code = ? AND expires_at > ?';
export const byHost = 'SELECT data, generation, expires_at FROM rooms WHERE host_key = ? AND expires_at > ?';
export const purge = 'DELETE FROM rooms WHERE expires_at <= ?';
export const addRoom = `INSERT OR IGNORE INTO rooms (code, host_key, data, expires_at)
  SELECT ?, ?, ?, ? WHERE (SELECT COUNT(*) FROM rooms) < 2000`;
export const changeRoom = 'UPDATE rooms SET data = ?, expires_at = ?, generation = generation + 1 WHERE code = ? AND generation = ?';
export const removeRoom = 'DELETE FROM rooms WHERE code = ? AND generation = ?';
export const readRow = row => row ? {
  room: JSON.parse(row.data), generation: row.generation, expiresAt: row.expires_at,
} : undefined;
