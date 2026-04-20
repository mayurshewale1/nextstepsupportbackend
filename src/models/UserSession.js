const Database = require('../config/database');
const crypto = require('crypto');

const MAX_DEVICES = 2;

class UserSession {
  static get MAX_DEVICES() {
    return MAX_DEVICES;
  }
  /**
   * Hash a token for storage (to avoid storing raw JWTs)
   */
  static hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Create a new session for a user
   * Returns { session, removedSessions } where removedSessions are oldest sessions
   * that were deactivated to make room for the new one
   */
  static async create(userId, sessionData = {}) {
    // First, get count of active sessions for this user
    const countResult = await Database.query(
      'SELECT COUNT(*) as count FROM user_sessions WHERE user_id = $1 AND is_active = true',
      [userId]
    );
    const activeCount = parseInt(countResult.rows[0].count, 10);

    let removedSessions = [];

    // If at or over limit, remove oldest sessions to make room
    if (activeCount >= MAX_DEVICES) {
      const sessionsToRemove = activeCount - MAX_DEVICES + 1; // +1 for the new session

      // Get oldest sessions that will be removed
      const oldestResult = await Database.query(
        `SELECT id, created_at, device_name 
         FROM user_sessions 
         WHERE user_id = $1 AND is_active = true 
         ORDER BY created_at ASC 
         LIMIT $2`,
        [userId, sessionsToRemove]
      );
      removedSessions = oldestResult.rows;

      // Deactivate oldest sessions
      const oldestIds = removedSessions.map(s => s.id);
      if (oldestIds.length > 0) {
        await Database.query(
          `UPDATE user_sessions 
           SET is_active = false, 
               updated_at = CURRENT_TIMESTAMP 
           WHERE id = ANY($1::int[])`,
          [oldestIds]
        );
      }
    }

    // Create new session
    const result = await Database.query(
      `INSERT INTO user_sessions 
       (user_id, device_id, device_name, ip_address, user_agent, token_hash, is_active, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, true, $7)
       RETURNING *`,
      [
        userId,
        sessionData.deviceId || null,
        sessionData.deviceName || null,
        sessionData.ipAddress || null,
        sessionData.userAgent || null,
        sessionData.tokenHash || null,
        sessionData.expiresAt || null
      ]
    );

    return {
      session: result.rows[0],
      removedSessions,
      wasLimited: activeCount >= MAX_DEVICES
    };
  }

  /**
   * Validate that a token hash is still active for the user
   */
  static async validateToken(userId, tokenHash) {
    const result = await Database.query(
      `SELECT * FROM user_sessions 
       WHERE user_id = $1 AND token_hash = $2 AND is_active = true
       AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)`,
      [userId, tokenHash]
    );
    return result.rows[0] || null;
  }

  /**
   * Deactivate a session by token hash
   */
  static async deactivateByToken(tokenHash) {
    const result = await Database.query(
      `UPDATE user_sessions 
       SET is_active = false, updated_at = CURRENT_TIMESTAMP
       WHERE token_hash = $1
       RETURNING *`,
      [tokenHash]
    );
    return result.rows[0] || null;
  }

  /**
   * Deactivate all sessions for a user (force logout everywhere)
   */
  static async deactivateAllForUser(userId) {
    const result = await Database.query(
      `UPDATE user_sessions 
       SET is_active = false, updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $1 AND is_active = true
       RETURNING id`,
      [userId]
    );
    return result.rows;
  }

  /**
   * Get active sessions for a user
   */
  static async getActiveSessions(userId) {
    const result = await Database.query(
      `SELECT id, device_id, device_name, ip_address, created_at, last_active_at
       FROM user_sessions 
       WHERE user_id = $1 AND is_active = true
       ORDER BY created_at DESC`,
      [userId]
    );
    return result.rows;
  }

  /**
   * Count active sessions for a user
   */
  static async countActiveSessions(userId) {
    const result = await Database.query(
      'SELECT COUNT(*) as count FROM user_sessions WHERE user_id = $1 AND is_active = true',
      [userId]
    );
    return parseInt(result.rows[0].count, 10);
  }

  /**
   * Update last active timestamp
   */
  static async updateLastActive(sessionId) {
    await Database.query(
      `UPDATE user_sessions 
       SET last_active_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [sessionId]
    );
  }

  /**
   * Clean up expired sessions
   */
  static async cleanupExpired() {
    const result = await Database.query(
      `UPDATE user_sessions 
       SET is_active = false
       WHERE is_active = true 
       AND expires_at IS NOT NULL 
       AND expires_at < CURRENT_TIMESTAMP
       RETURNING id`
    );
    return result.rows;
  }
}

module.exports = UserSession;
