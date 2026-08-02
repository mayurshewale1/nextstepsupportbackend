const Database = require('../config/database');

/**
 * Sanitize user object - remove password for API responses
 */
function sanitizeUser(user) {
  if (!user) return null;
  const { password, ...safe } = user;
  return safe;
}

function isContractSiteType(siteType) {
  const t = String(siteType || '').toLowerCase().trim();
  return t === 'amc' || t === 'cmc' || t === 'dlp';
}

function toJsonb(value) {
  if (value == null) return null;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return JSON.stringify(parsed);
    } catch {
      return null;
    }
  }
  if (typeof value === 'object') return JSON.stringify(value);
  return null;
}

function parseHandoverDates(value) {
  if (!value) return null;
  let arr = value;
  if (typeof value === 'string') {
    try {
      arr = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (!Array.isArray(arr) || arr.length === 0) return null;
  const cleaned = arr
    .filter((item) => item && (item.systemType || item.system_type) && (item.handoverDate || item.handover_date))
    .map((item) => ({
      systemType: item.systemType || item.system_type,
      handoverDate: item.handoverDate || item.handover_date,
    }));
  return cleaned.length > 0 ? JSON.stringify(cleaned) : null;
}

class User {
  static async create(user) {
    let systemTypesJson = null;
    if (user.systemTypes && Array.isArray(user.systemTypes) && user.systemTypes.length > 0) {
      systemTypesJson = JSON.stringify(user.systemTypes);
    } else if (user.system_types && Array.isArray(user.system_types) && user.system_types.length > 0) {
      systemTypesJson = JSON.stringify(user.system_types);
    }

    let systemTypeQuantitiesJson = null;
    if (user.systemTypeQuantities && typeof user.systemTypeQuantities === 'object' && Object.keys(user.systemTypeQuantities).length > 0) {
      systemTypeQuantitiesJson = JSON.stringify(user.systemTypeQuantities);
    } else if (user.system_type_quantities && typeof user.system_type_quantities === 'object' && Object.keys(user.system_type_quantities).length > 0) {
      systemTypeQuantitiesJson = JSON.stringify(user.system_type_quantities);
    }

    let customSystemsJson = null;
    if (user.customSystems && Array.isArray(user.customSystems) && user.customSystems.length > 0) {
      customSystemsJson = JSON.stringify(user.customSystems);
    }

    const systemHandoverDatesJson = parseHandoverDates(
      user.systemHandoverDates || user.system_handover_dates
    );

    const isBuilder =
      user.isBuilderDeveloper === true ||
      user.is_builder_developer === true ||
      user.isBuilderDeveloper === 'true' ||
      user.is_builder_developer === 'true';

    const result = await Database.query(
      `INSERT INTO users (
         user_id, email, password, name, role, phone, latitude, longitude,
         site_name, site_address, site_type, system_type, system_types,
         system_type_quantities, custom_systems, car_count, total_systems,
         state, area, area_head_id,
         is_builder_developer, project_name, project_id,
         system_handover_dates, contract_start_date, contract_end_date
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26)
       RETURNING *`,
      [
        user.userId || user.user_id,
        user.email,
        user.password,
        user.name || '',
        user.role || 'user',
        user.phone || null,
        user.latitude !== undefined ? user.latitude : null,
        user.longitude !== undefined ? user.longitude : null,
        user.siteName || user.site_name || null,
        user.siteAddress || user.site_address || null,
        user.siteType || user.site_type || null,
        user.systemType || user.system_type || (systemTypesJson ? JSON.parse(systemTypesJson)[0] : null),
        systemTypesJson,
        systemTypeQuantitiesJson,
        customSystemsJson,
        user.carCount || user.car_count || null,
        user.totalSystems || user.total_systems || null,
        user.state || null,
        user.area || null,
        user.areaHeadId || user.area_head_id || null,
        isBuilder,
        isBuilder ? (user.projectName || user.project_name || null) : null,
        isBuilder ? (user.projectId || user.project_id || null) : null,
        systemHandoverDatesJson,
        user.contractStartDate || user.contract_start_date || null,
        user.contractEndDate || user.contract_end_date || null,
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
   * Find all area heads for dropdown selection
   */
  static async findAreaHeads() {
    const result = await Database.query(
      `SELECT id, user_id, email, name, role, phone, state, area, is_active 
       FROM users 
       WHERE LOWER(role) = 'area_head' AND is_active = true 
       ORDER BY name ASC`
    );
    return result.rows;
  }

  /**
   * Find area head IDs for given user IDs (users get their area_head_id)
   */
  static async getAreaHeadIdsForUsers(userIds = []) {
    if (!Array.isArray(userIds) || userIds.length === 0) return [];
    const normalized = [...new Set(userIds.map(Number).filter(Boolean))];
    if (normalized.length === 0) return [];

    const result = await Database.query(
      `SELECT DISTINCT area_head_id 
       FROM users 
       WHERE id = ANY($1::int[]) 
         AND area_head_id IS NOT NULL 
         AND LOWER(role) IN ('user', 'engineer')`,
      [normalized]
    );
    return result.rows.map((r) => r.area_head_id).filter(Boolean);
  }

  /**
   * Find all users assigned to a specific area head (users and engineers)
   */
  static async findByAreaHeadId(areaHeadId) {
    const result = await Database.query(
      `SELECT id, user_id, email, name, role, phone, latitude, longitude, 
              site_name, site_address, site_type, system_type, system_types,
              system_type_quantities, custom_systems, car_count, 
              system_quantity, total_systems, state, area, area_head_id,
              is_builder_developer, project_name, project_id,
              system_handover_dates, contract_start_date, contract_end_date,
              is_active, created_at, updated_at 
       FROM users 
       WHERE area_head_id = $1 AND LOWER(role) IN ('user', 'engineer')
       ORDER BY role ASC, name ASC`,
      [areaHeadId]
    );
    return result.rows;
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
    let query = `SELECT id, user_id, email, name, role, phone, latitude, longitude,
                        site_name, site_address, site_type, system_type, system_types,
                        system_type_quantities, custom_systems, car_count, system_quantity,
                        total_systems, state, area, area_head_id,
                        is_builder_developer, project_name, project_id,
                        system_handover_dates, contract_start_date, contract_end_date,
                        is_active, created_at, updated_at
                 FROM users WHERE 1=1`;
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
    console.log('[DB] Executing query:', query);
    console.log('[DB] Query params:', params);
    try {
      const result = await Database.query(query, params);
      console.log('[DB] Query successful, rows returned:', result.rows.length);
      return result.rows;
    } catch (error) {
      console.error('[DB] Query failed:', error.message);
      console.error('[DB] Error code:', error.code);
      throw error;
    }
  }

  /**
   * Users whose DLP/AMC/CMC contract ends in exactly N days (for reminders)
   */
  static async findContractRemindersDue(daysAhead = 8) {
    const result = await Database.query(
      `SELECT id, user_id, email, name, phone, site_type, site_name, contract_end_date, area_head_id
       FROM users
       WHERE is_active = true
         AND contract_end_date IS NOT NULL
         AND LOWER(site_type) IN ('dlp', 'amc', 'cmc')
         AND contract_end_date = (CURRENT_DATE + ($1::int || ' days')::interval)::date
         AND (
           contract_reminder_sent_at IS NULL
           OR contract_reminder_sent_at::date < CURRENT_DATE
         )`,
      [daysAhead]
    );
    return result.rows;
  }

  static async markContractReminderSent(id) {
    await Database.query(
      `UPDATE users SET contract_reminder_sent_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [id]
    );
  }

  static async update(id, user) {
    const allowed = [
      'name', 'email', 'role', 'phone', 'avatar_url', 'is_active', 'user_id',
      'latitude', 'longitude', 'site_name', 'site_address', 'site_type',
      'system_type', 'system_types', 'system_type_quantities', 'custom_systems',
      'car_count', 'total_systems', 'state', 'area', 'area_head_id',
      'is_builder_developer', 'project_name', 'project_id',
      'system_handover_dates', 'contract_start_date', 'contract_end_date', 'contract_reminder_sent_at',
    ];
    const updates = [];
    const values = [];
    let paramIndex = 1;

    const keyMap = {
      userId: 'user_id',
      siteName: 'site_name',
      siteAddress: 'site_address',
      siteType: 'site_type',
      systemType: 'system_type',
      systemTypes: 'system_types',
      systemTypeQuantities: 'system_type_quantities',
      customSystems: 'custom_systems',
      carCount: 'car_count',
      totalSystems: 'total_systems',
      areaHeadId: 'area_head_id',
      isBuilderDeveloper: 'is_builder_developer',
      projectName: 'project_name',
      projectId: 'project_id',
      systemHandoverDates: 'system_handover_dates',
      contractStartDate: 'contract_start_date',
      contractEndDate: 'contract_end_date',
      contractReminderSentAt: 'contract_reminder_sent_at',
    };

    for (const key of Object.keys(user)) {
      const col = keyMap[key] || key;
      if (!allowed.includes(col) || user[key] === undefined) continue;

      if ((col === 'system_types' || col === 'custom_systems') && Array.isArray(user[key])) {
        values.push(JSON.stringify(user[key]));
      } else if (col === 'system_type_quantities' && typeof user[key] === 'object') {
        values.push(JSON.stringify(user[key]));
      } else if (col === 'system_handover_dates') {
        values.push(parseHandoverDates(user[key]));
      } else if (col === 'is_builder_developer') {
        values.push(user[key] === true || user[key] === 'true');
      } else {
        values.push(user[key] === '' ? null : user[key]);
      }

      updates.push(`${col} = $${paramIndex}`);
      paramIndex++;
    }

    // Clear project fields when builder flag is turned off
    if (Object.prototype.hasOwnProperty.call(user, 'isBuilderDeveloper') ||
        Object.prototype.hasOwnProperty.call(user, 'is_builder_developer')) {
      const isBuilder =
        user.isBuilderDeveloper === true ||
        user.is_builder_developer === true ||
        user.isBuilderDeveloper === 'true' ||
        user.is_builder_developer === 'true';
      if (!isBuilder) {
        if (!updates.some((u) => u.startsWith('project_name'))) {
          updates.push(`project_name = $${paramIndex}`);
          values.push(null);
          paramIndex++;
        }
        if (!updates.some((u) => u.startsWith('project_id'))) {
          updates.push(`project_id = $${paramIndex}`);
          values.push(null);
          paramIndex++;
        }
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
User.isContractSiteType = isContractSiteType;
module.exports = User;
