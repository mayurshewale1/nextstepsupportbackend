const Database = require('../config/database');

class Visit {
  /**
   * Create a new preventive maintenance visit
   */
  static async create(visit) {
    const result = await Database.query(
      `INSERT INTO preventive_visits (user_id, engineer_id, visit_date, status, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        visit.userId || visit.user_id,
        visit.engineerId || visit.engineer_id || null,
        visit.visitDate || visit.visit_date,
        visit.status || 'scheduled',
        visit.notes || null,
        visit.createdBy || visit.created_by,
      ]
    );
    return result.rows[0];
  }

  /**
   * Find visit by ID with user and engineer details
   */
  static async findById(id) {
    const result = await Database.query(
      `SELECT pv.*,
              u.name as user_name, u.email as user_email, u.phone as user_phone,
              u.site_name, u.site_address, u.state, u.area,
              e.name as engineer_name, e.email as engineer_email, e.phone as engineer_phone
       FROM preventive_visits pv
       LEFT JOIN users u ON pv.user_id = u.id
       LEFT JOIN users e ON pv.engineer_id = e.id
       WHERE pv.id = $1`,
      [id]
    );
    return result.rows[0] || null;
  }

  /**
   * Get all visits with optional filters
   */
  static async getAll(filters = {}) {
    let query = `
      SELECT pv.*,
             u.name as user_name, u.email as user_email, u.phone as user_phone,
             u.site_name, u.site_address, u.state, u.area,
             e.name as engineer_name, e.email as engineer_email, e.phone as engineer_phone
      FROM preventive_visits pv
      LEFT JOIN users u ON pv.user_id = u.id
      LEFT JOIN users e ON pv.engineer_id = e.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (filters.userId) {
      query += ` AND pv.user_id = $${paramIndex}`;
      params.push(filters.userId);
      paramIndex++;
    }

    if (filters.engineerId) {
      query += ` AND pv.engineer_id = $${paramIndex}`;
      params.push(filters.engineerId);
      paramIndex++;
    }

    if (filters.status) {
      query += ` AND pv.status = $${paramIndex}`;
      params.push(filters.status);
      paramIndex++;
    }

    if (filters.startDate) {
      query += ` AND pv.visit_date >= $${paramIndex}`;
      params.push(filters.startDate);
      paramIndex++;
    }

    if (filters.endDate) {
      query += ` AND pv.visit_date <= $${paramIndex}`;
      params.push(filters.endDate);
      paramIndex++;
    }

    // Filter for AMC users only
    if (filters.amcOnly) {
      query += ` AND (LOWER(u.site_type) = 'amc' OR LOWER(u.site_type) LIKE '%amc%')`;
    }

    query += ' ORDER BY pv.visit_date ASC';

    const result = await Database.query(query, params);
    return result.rows;
  }

  /**
   * Get upcoming visits for an engineer
   */
  static async getUpcomingVisits(engineerId, days = 30) {
    const result = await Database.query(
      `SELECT pv.*,
              u.name as user_name, u.email as user_email, u.phone as user_phone,
              u.site_name, u.site_address, u.state, u.area
       FROM preventive_visits pv
       LEFT JOIN users u ON pv.user_id = u.id
       WHERE pv.engineer_id = $1
         AND pv.status = 'scheduled'
         AND pv.visit_date >= CURRENT_DATE
         AND pv.visit_date <= CURRENT_DATE + INTERVAL '${days} days'
       ORDER BY pv.visit_date ASC`,
      [engineerId]
    );
    return result.rows;
  }

  /**
   * Get overdue visits
   */
  static async getOverdueVisits() {
    const result = await Database.query(
      `SELECT pv.*,
              u.name as user_name, u.email as user_email, u.phone as user_phone,
              u.site_name, u.site_address, u.state, u.area,
              e.name as engineer_name, e.email as engineer_email, e.phone as engineer_phone
       FROM preventive_visits pv
       LEFT JOIN users u ON pv.user_id = u.id
       LEFT JOIN users e ON pv.engineer_id = e.id
       WHERE pv.status = 'scheduled'
         AND pv.visit_date < CURRENT_DATE
       ORDER BY pv.visit_date ASC`
    );
    return result.rows;
  }

  /**
   * Update visit status
   */
  static async update(id, updates) {
    const allowed = ['engineer_id', 'visit_date', 'status', 'notes', 'completion_notes'];
    const setClauses = [];
    const values = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(updates)) {
      const col = key === 'engineerId' ? 'engineer_id' :
                  key === 'visitDate' ? 'visit_date' :
                  key === 'completionNotes' ? 'completion_notes' : key;

      if (allowed.includes(col) && value !== undefined) {
        setClauses.push(`${col} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    }

    // Add completed_at if status is being set to completed
    if (updates.status === 'completed') {
      setClauses.push(`completed_at = CURRENT_TIMESTAMP`);
    }

    if (setClauses.length === 0) return null;

    values.push(id);
    const result = await Database.query(
      `UPDATE preventive_visits
       SET ${setClauses.join(', ')}, updated_at = CURRENT_TIMESTAMP
       WHERE id = $${paramIndex}
       RETURNING *`,
      values
    );
    return result.rows[0] || null;
  }

  /**
   * Delete a visit
   */
  static async delete(id) {
    const result = await Database.query(
      'DELETE FROM preventive_visits WHERE id = $1',
      [id]
    );
    return result.rowCount > 0;
  }

  /**
   * Get visit statistics for a user
   */
  static async getUserVisitStats(userId) {
    const result = await Database.query(
      `SELECT
        COUNT(*) as total_visits,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_visits,
        COUNT(CASE WHEN status = 'scheduled' AND visit_date >= CURRENT_DATE THEN 1 END) as upcoming_visits,
        COUNT(CASE WHEN status = 'scheduled' AND visit_date < CURRENT_DATE THEN 1 END) as overdue_visits,
        MAX(CASE WHEN status = 'completed' THEN completed_at END) as last_visit_date
       FROM preventive_visits
       WHERE user_id = $1`,
      [userId]
    );
    return result.rows[0];
  }

  /**
   * Check if user needs a new visit (6 months from last visit or creation)
   */
  static async checkVisitNeeded(userId) {
    const result = await Database.query(
      `SELECT
        MAX(visit_date) as last_scheduled_visit,
        MAX(CASE WHEN status = 'completed' THEN completed_at END) as last_completed_visit
       FROM preventive_visits
       WHERE user_id = $1`,
      [userId]
    );

    const stats = result.rows[0];
    if (!stats.last_scheduled_visit && !stats.last_completed_visit) {
      return { needsVisit: true, reason: 'No previous visits' };
    }

    const lastVisit = stats.last_completed_visit || stats.last_scheduled_visit;
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    return {
      needsVisit: new Date(lastVisit) < sixMonthsAgo,
      lastVisitDate: lastVisit,
      reason: 'Last visit was more than 6 months ago'
    };
  }
}

module.exports = Visit;
