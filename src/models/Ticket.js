const Database = require('../config/database');

const VALID_STATUS = ['open', 'in-progress', 'completed', 'resolved', 'closed'];
const VALID_PRIORITY = ['low', 'medium', 'high'];

class Ticket {
  static async create(ticket) {
    const result = await Database.query(
      `INSERT INTO tickets (title, description, status, priority, category, created_by, assigned_to, latitude, longitude, image_path, image_paths)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        ticket.title,
        ticket.description,
        ticket.status || 'open',
        ticket.priority || 'medium',
        ticket.category || null,
        ticket.createdBy || ticket.created_by,
        ticket.assignedTo || ticket.assigned_to || null,
        ticket.latitude !== undefined ? ticket.latitude : null,
        ticket.longitude !== undefined ? ticket.longitude : null,
        ticket.imagePath || ticket.image_path || null,
        ticket.imagePaths || ticket.image_paths || null,
      ]
    );
    return result.rows[0];
  }

  static async findById(id) {
    const result = await Database.query(
      `SELECT t.*,
        u1.name as created_by_name, u1.email as created_by_email,
        u2.name as assigned_to_name, u2.email as assigned_to_email
       FROM tickets t
       LEFT JOIN users u1 ON t.created_by = u1.id
       LEFT JOIN users u2 ON t.assigned_to = u2.id
       WHERE t.id = $1`,
      [id]
    );
    return result.rows[0] || null;
  }

  static async findAll(filters = {}) {
    const { period, startDate, endDate, status, assignedTo, createdBy } = filters;
    let query = `
      SELECT t.*,
        u1.name as created_by_name, u1.email as created_by_email, u1.user_id as created_by_user_id,
        u2.name as assigned_to_name, u2.email as assigned_to_email, u2.user_id as assigned_to_user_id
      FROM tickets t
      LEFT JOIN users u1 ON t.created_by = u1.id
      LEFT JOIN users u2 ON t.assigned_to = u2.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (status) {
      query += ` AND t.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }
    if (assignedTo) {
      query += ` AND t.assigned_to = $${paramIndex}`;
      params.push(assignedTo);
      paramIndex++;
    }
    if (createdBy) {
      query += ` AND t.created_by = $${paramIndex}`;
      params.push(createdBy);
      paramIndex++;
    }

    // Date filters
    const now = new Date();
    if (period) {
      switch (period) {
        case 'today':
          query += ` AND t.created_at >= $${paramIndex} AND t.created_at < $${paramIndex + 1}`;
          params.push(
            new Date(now.getFullYear(), now.getMonth(), now.getDate()),
            new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
          );
          paramIndex += 2;
          break;
        case 'yesterday':
          query += ` AND t.created_at >= $${paramIndex} AND t.created_at < $${paramIndex + 1}`;
          params.push(
            new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1),
            new Date(now.getFullYear(), now.getMonth(), now.getDate())
          );
          paramIndex += 2;
          break;
        case 'weekly':
          const weekStart = new Date(now);
          weekStart.setDate(now.getDate() - now.getDay());
          query += ` AND t.created_at >= $${paramIndex} AND t.created_at <= $${paramIndex + 1}`;
          params.push(weekStart, now);
          paramIndex += 2;
          break;
        case 'monthly':
          query += ` AND t.created_at >= $${paramIndex} AND t.created_at < $${paramIndex + 1}`;
          params.push(
            new Date(now.getFullYear(), now.getMonth(), 1),
            new Date(now.getFullYear(), now.getMonth() + 1, 1)
          );
          paramIndex += 2;
          break;
        case 'yearly':
          query += ` AND t.created_at >= $${paramIndex} AND t.created_at < $${paramIndex + 1}`;
          params.push(
            new Date(now.getFullYear(), 0, 1),
            new Date(now.getFullYear() + 1, 0, 1)
          );
          paramIndex += 2;
          break;
      }
    }
    if (startDate && endDate) {
      query += ` AND t.created_at >= $${paramIndex} AND t.created_at <= $${paramIndex + 1}`;
      params.push(new Date(startDate), new Date(endDate));
    }

    query += ' ORDER BY t.created_at DESC';
    const result = await Database.query(query, params);
    return result.rows;
  }

  static async update(id, updates) {
    const allowed = ['title', 'description', 'status', 'priority', 'category', 'assigned_to', 'rating', 'resolution', 'feedback_comment'];
    const setClauses = [];
    const values = [];
    let paramIndex = 1;

    for (const key of Object.keys(updates)) {
      const col = key === 'assignedTo' ? 'assigned_to' : key === 'createdBy' ? 'created_by' : key;
      if (allowed.includes(col) && updates[key] !== undefined) {
        setClauses.push(`${col} = $${paramIndex}`);
        values.push(updates[key]);
        paramIndex++;
      }
    }
    if (updates.status === 'resolved' || updates.status === 'closed') {
      setClauses.push('resolved_at = CURRENT_TIMESTAMP');
    }
    if (setClauses.length === 0) return null;

    values.push(id);
    const result = await Database.query(
      `UPDATE tickets SET ${setClauses.join(', ')}, updated_at = CURRENT_TIMESTAMP
       WHERE id = $${paramIndex}
       RETURNING *`,
      values
    );
    return result.rows[0];
  }

  static async assign(id, assignedTo) {
    // Get current ticket to check status
    const existing = await this.findById(id);
    if (!existing) return null;
    
    // Only set status to 'in-progress' if ticket is still open
    // Don't overwrite resolved/completed/closed status
    const shouldUpdateStatus = existing.status === 'open';
    
    let query;
    let params;
    
    if (shouldUpdateStatus) {
      query = `UPDATE tickets SET assigned_to = $1, status = 'in-progress', updated_at = CURRENT_TIMESTAMP
               WHERE id = $2
               RETURNING *`;
      params = [assignedTo, id];
    } else {
      query = `UPDATE tickets SET assigned_to = $1, updated_at = CURRENT_TIMESTAMP
               WHERE id = $2
               RETURNING *`;
      params = [assignedTo, id];
    }
    
    const result = await Database.query(query, params);
    return result.rows[0];
  }

  static async delete(id) {
    const result = await Database.query(
      'DELETE FROM tickets WHERE id = $1',
      [id]
    );
    return result.rowCount > 0;
  }
}

module.exports = Ticket;
module.exports.VALID_STATUS = VALID_STATUS;
module.exports.VALID_PRIORITY = VALID_PRIORITY;
