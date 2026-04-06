const Ticket = require('../models/Ticket');
const User = require('../models/User');
const { emitTicketCreated, emitTicketAssigned, emitTicketUpdated } = require('../socket');
const { notifyRoles, notifyUsers } = require('../services/firebase');

/**
 * Haversine formula: distance in km between two lat/lng points
 */
function getDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Find nearest engineer to given coordinates. Returns engineer id or null.
 */
async function findNearestEngineer(userLat, userLon) {
  const engineers = await User.getAll({ role: 'engineer' });
  const withLocation = engineers.filter(
    (e) => e.latitude != null && e.longitude != null && e.is_active !== false
  );
  if (withLocation.length === 0) return null;

  let nearest = withLocation[0];
  let minDist = getDistanceKm(userLat, userLon, nearest.latitude, nearest.longitude);

  for (let i = 1; i < withLocation.length; i++) {
    const e = withLocation[i];
    const d = getDistanceKm(userLat, userLon, e.latitude, e.longitude);
    if (d < minDist) {
      minDist = d;
      nearest = e;
    }
  }
  return nearest.id;
}

class TicketController {
  static async sendCreateNotifications(ticket) {
    const title = 'New Complaint Created';
    const body = `Complaint #${ticket.id} has been created.`;
    await notifyRoles(['admin'], {
      notification: { title, body },
      data: { type: 'ticket_created', ticketId: String(ticket.id) },
    });

    if (ticket.assigned_to) {
      await notifyUsers([ticket.assigned_to], {
        notification: {
          title: 'New Complaint Assigned',
          body: `Complaint #${ticket.id} is assigned to you.`,
        },
        data: { type: 'ticket_assigned', ticketId: String(ticket.id) },
      });
    }
  }

  static async sendAssignedNotifications(ticket) {
    await notifyUsers([ticket.assigned_to], {
      notification: {
        title: 'Complaint Assigned',
        body: `Complaint #${ticket.id} has been assigned to you.`,
      },
      data: { type: 'ticket_assigned', ticketId: String(ticket.id) },
    });

    await notifyRoles(['admin'], {
      notification: {
        title: 'Complaint Assignment Updated',
        body: `Complaint #${ticket.id} assignment updated.`,
      },
      data: { type: 'ticket_updated', ticketId: String(ticket.id) },
    });
  }

  static async sendUpdateNotifications(ticket) {
    const isResolved = ticket.status === 'resolved' || ticket.status === 'closed';
    const recipientIds = [ticket.created_by, ticket.assigned_to].filter(Boolean);

    await notifyRoles(['admin'], {
      notification: {
        title: isResolved ? 'Complaint Resolved' : 'Complaint Progress Updated',
        body: `Complaint #${ticket.id} status: ${ticket.status}`,
      },
      data: { type: isResolved ? 'ticket_resolved' : 'ticket_updated', ticketId: String(ticket.id) },
    });

    await notifyUsers(recipientIds, {
      notification: {
        title: isResolved ? 'Complaint Resolved' : 'Complaint Updated',
        body: `Complaint #${ticket.id} status: ${ticket.status}`,
      },
      data: { type: isResolved ? 'ticket_resolved' : 'ticket_updated', ticketId: String(ticket.id) },
    });
  }

  static async sendFeedbackRequestNotification(ticket) {
    // Send notification to customer to provide feedback
    await notifyUsers([ticket.created_by], {
      notification: {
        title: 'Please Fill Feedback Form',
        body: `Your complaint #${ticket.id} has been resolved. Please provide your feedback.`,
      },
      data: { type: 'feedback_request', ticketId: String(ticket.id) },
    });
  }

  static async getTickets(req, res, next) {
    try {
      const { period, startDate, endDate, status, assignedTo } = req.query;
      const filters = { period, startDate, endDate, status, assignedTo };
      const userId = parseInt(req.user?.id, 10);
      if (req.user.role?.toLowerCase() === 'engineer') {
        filters.assignedTo = userId;
      } else if (req.user.role?.toLowerCase() === 'user') {
        filters.createdBy = userId;
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
      const { title, description, priority, category, latitude, longitude } = req.body;
      const createdBy = req.user?.id;
      if (!createdBy) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
      }

      let assignedTo = null;
      // Auto-assign to nearest engineer when user location is provided
      if (
        typeof latitude === 'number' &&
        typeof longitude === 'number' &&
        !isNaN(latitude) &&
        !isNaN(longitude)
      ) {
        assignedTo = await findNearestEngineer(latitude, longitude);
      }

      const ticket = await Ticket.create({
        title,
        description,
        status: assignedTo ? 'in-progress' : 'open',
        priority: priority || 'medium',
        category: category || null,
        createdBy,
        assignedTo,
        latitude: latitude ?? null,
        longitude: longitude ?? null,
      });

      const message = assignedTo
        ? 'Ticket created and assigned to nearest engineer'
        : 'Ticket created successfully';

      emitTicketCreated(ticket);
      TicketController.sendCreateNotifications(ticket).catch((e) => {
        console.error('[FCM] create notification error:', e.message);
      });

      res.status(201).json({
        success: true,
        message,
        data: ticket,
      });
    } catch (error) {
      next(error);
    }
  }

  static async createTicketWithImage(req, res, next) {
    try {
      const body = req.body || {};
      const title = body.title?.trim();
      const description = body.description?.trim();
      if (!title || !description) {
        return res.status(400).json({
          success: false,
          message: 'Title and description are required',
        });
      }
      const createdBy = req.user?.id;
      if (!createdBy) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
      }
      const priority = body.priority || 'medium';
      const category = body.category || null;
      let latitude = parseFloat(body.latitude);
      let longitude = parseFloat(body.longitude);
      if (isNaN(latitude)) latitude = null;
      if (isNaN(longitude)) longitude = null;

      let assignedTo = null;
      if (latitude != null && longitude != null) {
        assignedTo = await findNearestEngineer(latitude, longitude);
      }

      const imagePath = req.file ? req.file.filename : null;

      const ticket = await Ticket.create({
        title,
        description,
        status: assignedTo ? 'in-progress' : 'open',
        priority,
        category,
        createdBy,
        assignedTo,
        latitude,
        longitude,
        imagePath,
      });

      const message = assignedTo
        ? 'Ticket created and assigned to nearest engineer'
        : 'Ticket created successfully';

      emitTicketCreated(ticket);
      TicketController.sendCreateNotifications(ticket).catch((e) => {
        console.error('[FCM] create-with-image notification error:', e.message);
      });

      res.status(201).json({
        success: true,
        message,
        data: ticket,
      });
    } catch (error) {
      console.error('[createTicketWithImage]', error.message);
      if (process.env.NODE_ENV !== 'production') {
        console.error(error.stack);
      }
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

      const existing = await Ticket.findById(parseInt(id, 10));
      if (!existing) {
        return res.status(404).json({
          success: false,
          message: 'Ticket not found',
        });
      }
      if (existing.status === 'resolved' || existing.status === 'closed') {
        return res.status(400).json({
          success: false,
          message: 'Cannot update a completed ticket. Status is final.',
        });
      }

      // Check if trying to mark as resolved without feedback (but allow completed)
      if ((updates.status === 'resolved' || updates.status === 'closed') && 
          (!existing.rating && !existing.feedback_comment)) {
        return res.status(400).json({
          success: false,
          message: 'Ticket cannot be marked as resolved until feedback is submitted by customer.',
          requireFeedback: true,
        });
      }

      // Allow engineers to mark as "completed" without feedback requirement
      // Only "resolved" status requires feedback

      const ticket = await Ticket.update(parseInt(id, 10), updates);
      if (!ticket) {
        return res.status(404).json({
          success: false,
          message: 'Ticket not found',
        });
      }

      // Emit ticket updated event
      emitTicketUpdated(ticket);

      res.status(200).json({
        success: true,
        message: 'Ticket updated successfully',
        data: ticket,
      });
    } catch (error) {
      console.error('[updateTicket]', error.message);
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
      
      // Get engineer details for notification
      const engineer = await User.findById(assignedTo);
      const ticket = await Ticket.assign(parseInt(id, 10), assignedTo);
      
      if (!ticket) {
        return res.status(404).json({
          success: false,
          message: 'Ticket not found',
        });
      }
      
      // Add engineer details to ticket for notification
      ticket.engineer_name = engineer ? engineer.name : null;
      ticket.engineerName = engineer ? engineer.name : null;
      
      console.log('[ASSIGN] Emitting ticket:assigned with engineer:', engineer?.name);
      
      emitTicketAssigned(ticket);
      TicketController.sendAssignedNotifications(ticket).catch((e) => {
        console.error('[FCM] assign notification error:', e.message);
      });
      
      res.status(200).json({
        success: true,
        message: 'Ticket assigned successfully',
        data: ticket,
      });
    } catch (error) {
      next(error);
    }
  }

  static async submitFeedback(req, res, next) {
    try {
      const { id } = req.params;
      const { rating, feedback_comment: feedbackComment } = req.body;
      const ticket = await Ticket.findById(parseInt(id, 10));
      if (!ticket) {
        return res.status(404).json({
          success: false,
          message: 'Ticket not found',
        });
      }
      if (ticket.status !== 'completed' && ticket.status !== 'resolved' && ticket.status !== 'closed') {
        return res.status(400).json({
          success: false,
          message: 'Feedback can only be submitted for completed tickets',
        });
      }
      const isCreator = String(ticket.created_by) === String(req.user.id);
      const isAdmin = (req.user.role || '').toLowerCase() === 'admin';
      if (!isCreator && !isAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Only the ticket creator can submit feedback',
        });
      }
      const updates = {};
      if (rating != null && rating >= 1 && rating <= 5) updates.rating = rating;
      if (feedbackComment != null) updates.feedback_comment = feedbackComment;
      
      // Auto-convert "completed" to "resolved" when feedback is submitted
      if (ticket.status === 'completed') {
        updates.status = 'resolved';
      }
      
      if (Object.keys(updates).length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Rating (1-5) is required',
        });
      }
      const updated = await Ticket.update(parseInt(id, 10), updates);
      
      // Emit ticket updated event for feedback submission
      emitTicketUpdated(updated);
      
      // Check if status was auto-converted
      const statusChanged = ticket.status === 'completed' && updated.status === 'resolved';
      
      res.status(200).json({
        success: true,
        message: statusChanged 
          ? 'Feedback submitted successfully! Ticket marked as resolved.'
          : 'Feedback submitted successfully',
        data: updated,
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
