const Ticket = require('../models/Ticket');

class TicketController {
  static async getTickets(req, res, next) {
    try {
      const { period, startDate, endDate, status, assignedTo } = req.query;
      const filters = { period, startDate, endDate, status, assignedTo };
      if (req.user.role?.toLowerCase() === 'engineer') {
        filters.assignedTo = req.user.id;
      } else if (req.user.role?.toLowerCase() === 'user') {
        filters.createdBy = req.user.id;
      }
      const tickets = await Ticket.findAll(filters);
      res.status(200).json({
        success: true,
        data: tickets,
        count: tickets.length,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getTicketById(req, res, next) {
    try {
      const { id } = req.params;
      const ticket = await Ticket.findById(parseInt(id, 10));
      if (!ticket) {
        return res.status(404).json({
          success: false,
          message: 'Ticket not found',
        });
      }
      res.status(200).json({
        success: true,
        data: ticket,
      });
    } catch (error) {
      next(error);
    }
  }

  static async createTicket(req, res, next) {
    try {
      const { title, description, priority, category } = req.body;
      const createdBy = req.user?.id;
      if (!createdBy) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
      }
      const ticket = await Ticket.create({
        title,
        description,
        priority: priority || 'medium',
        category: category || null,
        createdBy,
      });
      res.status(201).json({
        success: true,
        message: 'Ticket created successfully',
        data: ticket,
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateTicket(req, res, next) {
    try {
      const { id } = req.params;
      const updates = { ...req.body };
      delete updates.created_by;
      delete updates.createdBy;
      delete updates.created_at;

      const ticket = await Ticket.update(parseInt(id, 10), updates);
      if (!ticket) {
        return res.status(404).json({
          success: false,
          message: 'Ticket not found',
        });
      }
      res.status(200).json({
        success: true,
        message: 'Ticket updated successfully',
        data: ticket,
      });
    } catch (error) {
      next(error);
    }
  }

  static async assignTicket(req, res, next) {
    try {
      const { id } = req.params;
      const { assignedTo } = req.body;
      if (!assignedTo) {
        return res.status(400).json({
          success: false,
          message: 'assignedTo is required',
        });
      }
      const ticket = await Ticket.assign(parseInt(id, 10), assignedTo);
      if (!ticket) {
        return res.status(404).json({
          success: false,
          message: 'Ticket not found',
        });
      }
      res.status(200).json({
        success: true,
        message: 'Ticket assigned successfully',
        data: ticket,
      });
    } catch (error) {
      next(error);
    }
  }

  static async deleteTicket(req, res, next) {
    try {
      const { id } = req.params;
      const success = await Ticket.delete(parseInt(id, 10));
      if (!success) {
        return res.status(404).json({
          success: false,
          message: 'Ticket not found',
        });
      }
      res.status(200).json({
        success: true,
        message: 'Ticket deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = TicketController;
