const Ticket = require('../models/Ticket');
const User = require('../models/User');
const { emitTicketCreated, emitTicketAssigned, emitTicketUpdated } = require('../socket');
const { notifyRoles, notifyUsers } = require('../services/firebase');
const { sendWhatsApp, sendStatusUpdate, sendOtpWhatsApp, formatPhoneNumber } = require('../services/whatsappService');
const { sendEmail, sendStatusUpdateEmail } = require('../services/emailService');

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

// In-memory OTP store for ticket completion: { ticketId -> { otp, expiresAt } }
const ticketOtpStore = new Map();
const TICKET_OTP_TTL_MS = 10 * 60 * 1000;

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/**
 * Fetch customer contact details for a ticket and send WhatsApp + email status update.
 * @param {object} ticket - Ticket object (must have id, created_by, status)
 */
async function sendTicketUpdateNotifications(ticket) {
  try {
    const serviceId = `NXP-SVC-${String(ticket.id).padStart(6, '0')}`;
    const user = await User.findById(ticket.created_by);
    if (!user) return;

    const customerName = user.name || 'Customer';
    const phoneNumber = user.phone ? formatPhoneNumber(user.phone) : null;
    const customerEmail = user.email || null;

    if (phoneNumber) {
      sendStatusUpdate(phoneNumber, customerName, serviceId, ticket.status).catch((e) => {
        console.error('[WhatsApp] Failed to send status update:', e.message);
      });
    } else {
      console.warn('[WhatsApp] No phone for status update, userId:', ticket.created_by);
    }

    if (customerEmail) {
      sendStatusUpdateEmail(customerEmail, customerName, serviceId, ticket.status).catch((e) => {
        console.error('[Email] Failed to send status update:', e.message);
      });
    } else {
      console.warn('[Email] No email for status update, userId:', ticket.created_by);
    }

    console.log('[Notifications] Triggered WhatsApp and email status update for ticket:', serviceId);
  } catch (e) {
    console.error('[sendTicketUpdateNotifications] Error:', e.message);
  }
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
        latitude: latitude !== undefined ? latitude : null,
        longitude: longitude !== undefined ? longitude : null,
      });

      // Generate service ID for WhatsApp
      const serviceId = `NXP-SVC-${String(ticket.id).padStart(6, '0')}`;

      // Get user details for WhatsApp
      const user = await User.findById(createdBy);
      const customerName = user?.name || 'Customer';
      const phoneNumber = user?.phone ? formatPhoneNumber(user.phone) : null;
      
      // Extract customer email from user object or description field
      let customerEmail = user?.email || null;
      if (!customerEmail && ticket.description) {
        // Extract email from description using regex
        const emailMatch = ticket.description.match(/Email:\s*([^\s\n]+@[^\s\n]+\.[^\s\n]+)/);
        if (emailMatch && emailMatch[1]) {
          customerEmail = emailMatch[1].trim();
        }
      }

      const message = assignedTo
        ? 'Ticket created and assigned to nearest engineer'
        : 'Ticket created successfully';

      emitTicketCreated(ticket);
      TicketController.sendCreateNotifications(ticket).catch((e) => {
        console.error('[FCM] create notification error:', e.message);
      });

      // Send WhatsApp acknowledgment (async - don't block response)
      if (phoneNumber) {
        sendWhatsApp(phoneNumber, customerName, serviceId, category).catch((error) => {
          console.error('[WhatsApp] Failed to send acknowledgment:', error.message);
          // Don't fail API response if WhatsApp fails
        });
      } else {
        console.warn('[WhatsApp] No phone number available for user:', createdBy);
      }

      // Send email acknowledgment (async - don't block response)
      if (customerEmail) {
        sendEmail(customerEmail, customerName, serviceId, category).catch((error) => {
          console.error('[Email] Failed to send acknowledgment:', error.message);
          // Don't fail API response if email fails
        });
      } else {
        console.log('[Email] No customer email available for ticket:', serviceId);
      }
      
      console.log('[Notifications] Triggered WhatsApp and email acknowledgments for ticket:', serviceId);

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
      console.log('[createTicketWithImage] Request received');
      console.log('[createTicketWithImage] Files count:', req.files?.length || 0);
      console.log('[createTicketWithImage] Files:', req.files);
      console.log('[createTicketWithImage] Body:', req.body);
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

      // Handle multiple images
      let imagePaths = [];
      if (req.files && Array.isArray(req.files) && req.files.length > 0) {
        imagePaths = req.files.map(file => file.filename);
      } else if (req.file) {
        // Fallback for single file (backward compatibility)
        imagePaths = [req.file.filename];
      }

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
        imagePath: imagePaths.length > 0 ? imagePaths[0] : null, // Keep single image_path for backward compatibility
        imagePaths: imagePaths.length > 0 ? JSON.stringify(imagePaths) : null, // Store all images as JSON
      });

      // Generate service ID for WhatsApp
      const serviceId = `NXP-SVC-${String(ticket.id).padStart(6, '0')}`;

      // Get user details for WhatsApp
      const user = await User.findById(createdBy);
      const customerName = user?.name || 'Customer';
      const phoneNumber = user?.phone ? formatPhoneNumber(user.phone) : null;
      
      // Extract customer email from description field
      let customerEmail = user?.email || null;
      if (!customerEmail && description) {
        // Extract email from description using regex
        const emailMatch = description.match(/Email:\s*([^\s\n]+@[^\s\n]+\.[^\s\n]+)/);
        if (emailMatch && emailMatch[1]) {
          customerEmail = emailMatch[1].trim();
        }
      }

      const message = assignedTo
        ? 'Ticket created and assigned to nearest engineer'
        : 'Ticket created successfully';

      try {
        emitTicketCreated(ticket);
      } catch (socketError) {
        console.error('[Socket] Error emitting ticket created:', socketError.message);
      }
      
      // Send notifications asynchronously - don't let notification errors fail the ticket creation
      setImmediate(() => {
        try {
          TicketController.sendCreateNotifications(ticket).catch((e) => {
            console.error('[FCM] create-with-image notification error:', e.message);
          });
        } catch (notificationError) {
          console.error('[FCM] Error in notification process:', notificationError.message);
        }
      });

      // Send WhatsApp acknowledgment (async - don't block response)
      try {
        if (phoneNumber) {
          sendWhatsApp(phoneNumber, customerName, serviceId, category).catch((error) => {
            console.error('[WhatsApp] Failed to send acknowledgment:', error.message);
            // Don't fail the API response if WhatsApp fails
          });
        } else {
          console.warn('[WhatsApp] No phone number available for user:', createdBy);
        }
      } catch (whatsappError) {
        console.error('[WhatsApp] Error in WhatsApp process:', whatsappError.message);
      }

      // Send email acknowledgment (async - don't block response)
      try {
        if (customerEmail) {
          sendEmail(customerEmail, customerName, serviceId, category).catch((error) => {
            console.error('[Email] Failed to send acknowledgment:', error.message);
            // Don't fail API response if email fails
          });
        } else {
          console.log('[Email] No customer email available for ticket:', serviceId);
        }
      } catch (emailError) {
        console.error('[Email] Error in email process:', emailError.message);
      }
      
      console.log('[Notifications] Triggered WhatsApp and email acknowledgments for ticket:', serviceId);

      // CRITICAL: Always send success response after ticket creation
      // This ensures the user gets confirmation even if notifications fail
      try {
        console.log('[createTicketWithImage] About to send success response');
        res.status(201).json({
          success: true,
          message,
          data: ticket,
        });
        console.log('[createTicketWithImage] Success response sent');
      } catch (responseError) {
        console.error('[Response] Error sending success response:', responseError.message);
        // Try to send a basic response if the main one fails
        if (!res.headersSent) {
          res.status(201).json({
            success: true,
            message: 'Ticket created successfully',
            data: ticket,
          });
        }
      }
    } catch (error) {
      console.error('[createTicketWithImage] ERROR:', error.message);
      console.error('[createTicketWithImage] ERROR TYPE:', error.constructor.name);
      console.error('[createTicketWithImage] ERROR STACK:', error.stack);
      
      // Handle specific multer errors
      if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({
          success: false,
          message: 'File size too large. Maximum size is 10MB per file.',
        });
      }
      
      if (error.code === 'LIMIT_FILE_COUNT') {
        return res.status(413).json({
          success: false,
          message: 'Too many files. Maximum is 5 files per ticket.',
        });
      }
      
      if (error.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.status(400).json({
          success: false,
          message: 'Unexpected file field. Please use "images" field.',
        });
      }
      
      // Handle file filter errors
      if (error.message && error.message.includes('Only image files')) {
        return res.status(400).json({
          success: false,
          message: error.message,
        });
      }
      
      // For database errors or other unexpected errors
      if (process.env.NODE_ENV !== 'production') {
        console.error(error.stack);
      }
      
      res.status(500).json({
        success: false,
        message: 'Internal server error. Please try again.',
      });
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

      // If engineer is marking as completed, send OTP to user first
      if (updates.status === 'completed') {
        const user = await User.findById(existing.created_by);
        if (!user || !user.phone) {
          return res.status(400).json({
            success: false,
            message: 'Cannot complete ticket: customer has no phone number registered.',
          });
        }
        const otp = generateOtp();
        ticketOtpStore.set(String(id), {
          otp,
          expiresAt: Date.now() + TICKET_OTP_TTL_MS,
          updates,
        });
        const phone = formatPhoneNumber(user.phone);
        const result = await sendOtpWhatsApp(phone, user.name || 'Customer', otp);
        if (!result.success) {
          ticketOtpStore.delete(String(id));
          return res.status(500).json({
            success: false,
            message: 'Failed to send OTP to customer. Please try again.',
          });
        }
        return res.status(200).json({
          success: true,
          requiresOtp: true,
          message: 'OTP sent to customer WhatsApp. Please ask customer to verify.',
          phone: user.phone.replace(/(\d{2})\d+(\d{2})/, '$1****$2'),
        });
      }

      const ticket = await Ticket.update(parseInt(id, 10), updates);
      if (!ticket) {
        return res.status(404).json({
          success: false,
          message: 'Ticket not found',
        });
      }

      emitTicketUpdated(ticket);
      sendTicketUpdateNotifications(ticket);

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

  static async verifyTicketCompletion(req, res, next) {
    try {
      const { id } = req.params;
      const { otp } = req.body;
      if (!otp) {
        return res.status(400).json({ success: false, message: 'OTP is required' });
      }
      const record = ticketOtpStore.get(String(id));
      if (!record) {
        return res.status(400).json({ success: false, message: 'No pending completion OTP. Please request again.' });
      }
      if (Date.now() > record.expiresAt) {
        ticketOtpStore.delete(String(id));
        return res.status(400).json({ success: false, message: 'OTP has expired. Please request again.' });
      }
      if (record.otp !== String(otp).trim()) {
        return res.status(400).json({ success: false, message: 'Invalid OTP. Please try again.' });
      }
      ticketOtpStore.delete(String(id));

      const ticket = await Ticket.update(parseInt(id, 10), record.updates);
      if (!ticket) {
        return res.status(404).json({ success: false, message: 'Ticket not found' });
      }
      emitTicketUpdated(ticket);
      sendTicketUpdateNotifications(ticket);

      return res.status(200).json({
        success: true,
        message: 'Ticket marked as completed successfully',
        data: ticket,
      });
    } catch (error) {
      console.error('[verifyTicketCompletion]', error.message);
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

      // Send WhatsApp + email assignment notification to customer
      sendTicketUpdateNotifications(ticket);
      
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

      // Send WhatsApp + email status update to customer
      sendTicketUpdateNotifications(updated);

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
