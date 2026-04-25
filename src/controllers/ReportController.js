const Database = require('../config/database');
const exceljs = require('exceljs');
const Ticket = require('../models/Ticket');
const User = require('../models/User');

class ReportController {
  static async downloadTicketsExcel(req, res, next) {
    try {
      const tickets = await Ticket.findAll({});
      
      const workbook = new exceljs.Workbook();
      const worksheet = workbook.addWorksheet('All Tickets');
      
      // Styling the header row
      const columns = [
        { header: 'ID', key: 'id', width: 10 },
        { header: 'Title', key: 'title', width: 30 },
        { header: 'Description', key: 'description', width: 40 },
        { header: 'Status', key: 'status', width: 15 },
        { header: 'Priority', key: 'priority', width: 15 },
        { header: 'Category', key: 'category', width: 20 },
        { header: 'Created By ID', key: 'created_by', width: 15 },
        { header: 'Assigned To ID', key: 'assigned_to', width: 15 },
        { header: 'System Type', key: 'system_type', width: 20 },
        { header: 'System Number', key: 'system_number', width: 20 },
        { header: 'Created At', key: 'created_at', width: 25 },
        { header: 'Completed At', key: 'completed_at', width: 25 },
        { header: 'Rating', key: 'rating', width: 10 },
        { header: 'Feedback', key: 'feedback_comment', width: 30 },
      ];
      worksheet.columns = columns;

      worksheet.getRow(1).font = { bold: true };

      tickets.forEach(ticket => {
        worksheet.addRow(ticket);
      });
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="all_tickets.xlsx"');
      
      await workbook.xlsx.write(res);
      res.end();
    } catch (error) {
      next(error);
    }
  }

  static async downloadEngineerTicketsExcel(req, res, next) {
    try {
      const { id } = req.params;
      const engineer = await User.findById(parseInt(id, 10));
      if (!engineer) {
        return res.status(404).json({ success: false, message: 'Engineer not found' });
      }

      // Find tickets assigned to this engineer and solved
      const query = `
        SELECT t.*, u.name as customer_name, u.phone as customer_phone
        FROM tickets t
        LEFT JOIN users u ON t.created_by = u.id
        WHERE t.assigned_to = $1 AND (t.status = 'resolved' OR t.status = 'closed')
        ORDER BY t.completed_at DESC NULLS LAST
      `;
      const result = await Database.query(query, [id]);
      const tickets = result.rows;

      const workbook = new exceljs.Workbook();
      const worksheet = workbook.addWorksheet(`Tickets - ${engineer.name}`);

      worksheet.columns = [
        { header: 'Ticket ID', key: 'id', width: 10 },
        { header: 'Customer Name', key: 'customer_name', width: 20 },
        { header: 'Customer Phone', key: 'customer_phone', width: 15 },
        { header: 'Title', key: 'title', width: 30 },
        { header: 'Category', key: 'category', width: 15 },
        { header: 'Status', key: 'status', width: 15 },
        { header: 'Completed At', key: 'completed_at', width: 25 },
        { header: 'Rating', key: 'rating', width: 10 },
        { header: 'Customer Feedback', key: 'feedback_comment', width: 40 },
      ];

      worksheet.getRow(1).font = { bold: true };

      tickets.forEach(ticket => {
        worksheet.addRow(ticket);
      });

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="engineer_${id}_tickets.xlsx"`);
      
      await workbook.xlsx.write(res);
      res.end();
    } catch (error) {
      next(error);
    }
  }
}

module.exports = ReportController;
