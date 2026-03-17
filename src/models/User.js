const Database = require('../config/database');

/**
 * Sanitize user object - remove password for API responses
 */
function sanitizeUser(user) {
  if (!user) return null;
  const { password, ...safe } = user;
  return safe;
}

class User {
  static async create(user) {
    const result = await Database.query(
      `INSERT INTO users (user_id, email, password, name, role, phone, latitude, longitude, site_name, site_address, site_type)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        user.userId || user.user_id,
        user.email,
        user.password,
        user.name || '',
        user.role || 'user',
        user.phone || null,
        user.latitude ?? null,
        user.longitude ?? null,
        user.siteName || user.site_name || null,
        user.siteAddress || user.site_address || null,
        user.siteType || user.site_type || null,
      ]
    );
    return result.rows[0];
  }

  static async findById(id) {
    const result = await Database.query(
      'SELECT * FROM users WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  static async findByEmail(email) {
    const result = await Database.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );
    return result.rows[0] || null;
  }

  static async findByUserId(userId) {
    const result = await Database.query(
      'SELECT * FROM users WHERE user_id = $1',
      [userId]
    );
    return result.rows[0] || null;
  }

  /**
   * Find by user_id OR email (for login)
   */
  static async findByUserIdOrEmail(userIdOrEmail) {
    const result = await Database.query(
      'SELECT * FROM users WHERE user_id = $1 OR email = $1',
      [userIdOrEmail]
    );
    return result.rows[0] || null;
  }

  static async getAll(filters = {}) {
    let query = 'SELECT id, user_id, email, name, role, phone, latitude, longitude, site_name, site_address, site_type, is_active, created_at, updated_at FROM users WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    if (filters.role) {
      query += ` AND LOWER(role) = LOWER($${paramIndex})`;
      params.push(String(filters.role).trim());
      paramIndex++;
    }
    if (filters.is_active !== undefined) {
      query += ` AND is_active = $${paramIndex}`;
      params.push(filters.is_active);
      paramIndex++;
    }

    query += ' ORDER BY created_at DESC';
    const result = await Database.query(query, params);
    return result.rows;
  }

  static async update(id, user) {
    const allowed = ['name', 'email', 'role', 'phone', 'avatar_url', 'is_active', 'user_id', 'latitude', 'longitude', 'site_name', 'site_address', 'site_type'];
    const updates = [];
    const values = [];
    let paramIndex = 1;

    for (const key of Object.keys(user)) {
      let col = key === 'userId' ? 'user_id' : key;
      if (key === 'siteName') col = 'site_name';
      if (key === 'siteAddress') col = 'site_address';
      if (key === 'siteType') col = 'site_type';
      if (allowed.includes(col) && user[key] !== undefined) {
        updates.push(`${col} = $${paramIndex}`);
        values.push(user[key]);
        paramIndex++;
      }
    }
    if (updates.length === 0) return null;

    values.push(id);
    const result = await Database.query(
      `UPDATE users SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
       WHERE id = $${paramIndex}
       RETURNING *`,
      values
    );
    return result.rows[0];
  }

  static async updatePassword(id, hashedPassword) {
    const result = await Database.query(
      'UPDATE users SET password = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      [hashedPassword, id]
    );
    return result.rows[0];
  }

  static async delete(id) {
    const result = await Database.query(
      'DELETE FROM users WHERE id = $1',
      [id]
    );
    return result.rowCount > 0;
  }
}

User.sanitizeUser = sanitizeUser;
module.exports = User;
