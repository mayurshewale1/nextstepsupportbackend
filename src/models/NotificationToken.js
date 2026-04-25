const Database = require('../config/database');

class NotificationToken {
  static async register({ userId, token, platform }) {
    const result = await Database.query(
      `INSERT INTO notification_tokens (user_id, token, platform, updated_at)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
       ON CONFLICT (token)
       DO UPDATE SET user_id = EXCLUDED.user_id, platform = EXCLUDED.platform, updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [userId, token, platform || null]
    );
    return result.rows[0] || null;
  }

  static async unregister({ userId, token }) {
    const result = await Database.query(
      'DELETE FROM notification_tokens WHERE user_id = $1 AND token = $2',
      [userId, token]
    );
    return result.rowCount > 0;
  }

  static async getTokensByUserIds(userIds = []) {
    if (!Array.isArray(userIds) || userIds.length === 0) return [];
    const normalized = [...new Set(userIds.map(Number).filter(Boolean))];
    if (normalized.length === 0) return [];

    const result = await Database.query(
      'SELECT DISTINCT token FROM notification_tokens WHERE user_id = ANY($1::int[])',
      [normalized]
    );
    return result.rows.map((r) => r.token).filter(Boolean);
  }

  static async getTokensByRoles(roles = []) {
    if (!Array.isArray(roles) || roles.length === 0) return [];
    const normalized = [...new Set(roles.map((r) => String(r).toLowerCase()))];

    const result = await Database.query(
      `SELECT DISTINCT nt.token
       FROM notification_tokens nt
       INNER JOIN users u ON u.id = nt.user_id
       WHERE LOWER(u.role) = ANY($1::text[]) AND u.is_active = true`,
      [normalized]
    );
    return result.rows.map((r) => r.token).filter(Boolean);
  }

  static async unregisterByToken(token) {
    const result = await Database.query(
      'DELETE FROM notification_tokens WHERE token = $1',
      [token]
    );
    return result.rowCount > 0;
  }

  static async getUserTokens(userId) {
    const result = await Database.query(
      'SELECT token, platform, updated_at FROM notification_tokens WHERE user_id = $1 ORDER BY updated_at DESC',
      [userId]
    );
    return result.rows;
  }
}

module.exports = NotificationToken;
