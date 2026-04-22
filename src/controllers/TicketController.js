const path = require('path');
const Ticket = require('../models/Ticket');
const User = require('../models/User');
const { emitTicketCreated, emitTicketAssigned, emitTicketUpdated } = require('../socket');
const { notifyRoles, notifyUsers } = require('../services/firebase');
const { sendWhatsApp, sendStatusUpdate, sendOtpWhatsApp, formatPhoneNumber, sendEngineerAssignmentNotification, sendAdminTicketNotification } = require('../services/whatsappService');
const { sendEmail, sendStatusUpdateEmail, sendEngineerAssignmentEmail, sendAdminTicketEmail } = require('../services/emailService');

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
 * Fetch all related users for a ticket and send WhatsApp + email notifications.
 * Notifies: customer (who created ticket), assigned engineer, and all admins.
 * @param {object} ticket - Ticket object (must have id, created_by, status, assigned_to)
 * @param {string} notificationType - Type of notification: 'status_update', 'assignment', 'new_ticket'
 * @param {object} options - Additional options including updatedBy user
 */
async function sendTicketUpdateNotifications(ticket, notificationType = 'status_update', options = {}) {
  try {
    const serviceId = `NXP-SVC-${String(ticket.id).padStart(6, '0')}`;

    // Fetch customer details with full info
    const customer = await User.findById(ticket.created_by);
    const customerName = customer?.name || 'Customer';
    const customerPhoneRaw = customer?.phone || null;
    const customerPhone = customerPhoneRaw ? formatPhoneNumber(customerPhoneRaw) : null;
    const customerEmail = customer?.email || null;
    const siteAddress = customer?.site_address || customer?.siteAddress || '';

    // Fetch assigned engineer details if exists
    let engineer = null;
    let engineerName = null;
    let engineerPhone = null;
    let engineerEmail = null;
    if (ticket.assigned_to) {
      engineer = await User.findById(ticket.assigned_to);
      engineerName = engineer?.name || 'Engineer';
      engineerPhone = engineer?.phone ? formatPhoneNumber(engineer.phone) : null;
      engineerEmail = engineer?.email || null;
    }

    // Fetch all admins for notifications
    const admins = await User.getAll({ role: 'admin' });

    // Get updater info if provided
    const updatedByName = options.updatedByName || '';

    // Build ticket details object with full information
    const ticketDetails = {
      title: ticket.title || '',
      priority: ticket.priority || 'medium',
      category: ticket.category || 'General',
      description: ticket.description || '',
      assignedToName: engineerName || '',
      customerPhone: customerPhoneRaw || '',
      customerEmail: customerEmail || '',
      siteAddress: siteAddress || '',
      latitude: ticket.latitude || null,
      longitude: ticket.longitude || null,
      updatedBy: updatedByName,
      actionType: notificationType === 'new_ticket' ? 'created' : notificationType === 'assignment' ? 'assigned' : 'updated'
    };

    // Build update details for status updates
    const updateDetails = {
      category: ticket.category || '',
      priority: ticket.priority || '',
      assignedToName: engineerName || '',
      updatedBy: updatedByName,
      notes: options.notes || '',
      title: ticket.title || ''
    };

    console.log('[Notifications] Sending detailed notifications to related users for ticket:', serviceId, {
      notificationType,
      customerId: ticket.created_by,
      engineerId: ticket.assigned_to,
      adminCount: admins.length,
      hasLocation: !!(ticket.latitude && ticket.longitude)
    });

    // 1. NOTIFY CUSTOMER (who created the ticket)
    if (notificationType === 'status_update' || notificationType === 'new_ticket') {
      // Customer gets status updates with full details
      if (customerPhone) {
        sendStatusUpdate(customerPhone, customerName, serviceId, ticket.status, updateDetails).catch((e) => {
          console.error('[WhatsApp] Failed to send customer status update:', e.message);
        });
      }
      if (customerEmail) {
        sendStatusUpdateEmail(customerEmail, customerName, serviceId, ticket.status, updateDetails).catch((e) => {
          console.error('[Email] Failed to send customer status update:', e.message);
        });
      }
    }

    // 2. NOTIFY ASSIGNED ENGINEER
    if (engineer && ticket.assigned_to) {
      if (notificationType === 'assignment') {
        // Engineer gets detailed assignment notification
        if (engineerPhone) {
          sendEngineerAssignmentNotification(engineerPhone, engineerName, serviceId, customerName, ticket.category, ticketDetails).catch((e) => {
            console.error('[WhatsApp] Failed to send engineer assignment notification:', e.message);
          });
        }
        if (engineerEmail) {
          sendEngineerAssignmentEmail(engineerEmail, engineerName, serviceId, customerName, ticket.category, ticketDetails).catch((e) => {
            console.error('[Email] Failed to send engineer assignment email:', e.message);
          });
        }
      } else if (notificationType === 'status_update') {
        // Engineer gets status updates about their assigned tickets
        if (engineerPhone) {
          sendAdminTicketNotification(engineerPhone, engineerName, serviceId, ticket.status, customerName, ticketDetails).catch((e) => {
            console.error('[WhatsApp] Failed to send engineer status update:', e.message);
          });
        }
        if (engineerEmail) {
          sendAdminTicketEmail(engineerEmail, engineerName, serviceId, ticket.status, customerName, ticketDetails).catch((e) => {
            console.error('[Email] Failed to send engineer status update:', e.message);
          });
        }
      }
    }

    // 3. NOTIFY ALL ADMINS
    for (const admin of admins) {
      const adminPhone = admin.phone ? formatPhoneNumber(admin.phone) : null;
      const adminEmail = admin.email || null;
      const adminName = admin.name || 'Admin';

      if (adminPhone) {
        sendAdminTicketNotification(adminPhone, adminName, serviceId, ticket.status, customerName, ticketDetails).catch((e) => {
          console.error('[WhatsApp] Failed to send admin notification:', e.message);
        });
      }
      if (adminEmail) {
        sendAdminTicketEmail(adminEmail, adminName, serviceId, ticket.status, customerName, ticketDetails).catch((e) => {
          console.error('[Email] Failed to send admin notification:', e.message);
        });
      }
    }

    console.log('[Notifications] Detailed WhatsApp and email notifications sent to all related users for ticket:', serviceId);
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
      const { title, description, priority, category, latitude, longitude, systemType, systemNumber } = req.body;
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
        systemType: systemType || null,
        systemNumber: systemNumber || null,
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

      // Prepare detailed ticket info for notifications
      const customerPhoneRaw = user?.phone || null;
      const siteAddress = user?.site_address || user?.siteAddress || '';
      
      // Get engineer name for customer notification if assigned
      let assignedToName = '';
      if (assignedTo) {
        const engineer = await User.findById(assignedTo);
        assignedToName = engineer?.name || '';
      }
      
      // Build detailed ticket details
      const ticketDetails = {
        title: title || '',
        priority: priority || 'medium',
        category: category || 'General',
        description: description || '',
        assignedToName: assignedToName,
        customerPhone: customerPhoneRaw || '',
        customerEmail: customerEmail || '',
        siteAddress: siteAddress || '',
        latitude: latitude !== undefined ? latitude : null,
        longitude: longitude !== undefined ? longitude : null,
        actionType: 'created'
      };

      // Send notifications to all related users (async - don't block response)
      setImmediate(async () => {
        try {
          // 1. Send detailed acknowledgment to customer
          if (phoneNumber) {
            sendWhatsApp(phoneNumber, customerName, serviceId, category, ticketDetails).catch((error) => {
              console.error('[WhatsApp] Failed to send customer acknowledgment:', error.message);
            });
          }
          if (customerEmail) {
            sendEmail(customerEmail, customerName, serviceId, category, ticketDetails).catch((error) => {
              console.error('[Email] Failed to send customer acknowledgment:', error.message);
            });
          }

          // 2. Notify admins about new ticket with full details
          const admins = await User.getAll({ role: 'admin' });
          for (const admin of admins) {
            const adminPhone = admin.phone ? formatPhoneNumber(admin.phone) : null;
            const adminEmail = admin.email || null;
            const adminName = admin.name || 'Admin';
            if (adminPhone) {
              sendAdminTicketNotification(adminPhone, adminName, serviceId, ticket.status, customerName, ticketDetails).catch((e) => {
                console.error('[WhatsApp] Failed to send admin new ticket notification:', e.message);
              });
            }
            if (adminEmail) {
              sendAdminTicketEmail(adminEmail, adminName, serviceId, ticket.status, customerName, ticketDetails).catch((e) => {
                console.error('[Email] Failed to send admin new ticket notification:', e.message);
              });
            }
          }

          // 3. If auto-assigned, notify the engineer with full details
          if (assignedTo) {
            const engineer = await User.findById(assignedTo);
            if (engineer) {
              const engineerPhone = engineer.phone ? formatPhoneNumber(engineer.phone) : null;
              const engineerEmail = engineer.email || null;
              const engineerName = engineer.name || 'Engineer';
              if (engineerPhone) {
                sendEngineerAssignmentNotification(engineerPhone, engineerName, serviceId, customerName, category, ticketDetails).catch((e) => {
                  console.error('[WhatsApp] Failed to send engineer assignment notification:', e.message);
                });
              }
              if (engineerEmail) {
                sendEngineerAssignmentEmail(engineerEmail, engineerName, serviceId, customerName, category, ticketDetails).catch((e) => {
                  console.error('[Email] Failed to send engineer assignment email:', e.message);
                });
              }
            }
          }

          console.log('[Notifications] Sent detailed WhatsApp and email notifications to all related users for new ticket:', serviceId);
        } catch (notificationError) {
          console.error('[Notifications] Error sending new ticket notifications:', notificationError.message);
        }
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
      console.log('[createTicketWithImage] Request received');
      const imageCount = req.files?.images?.length || 0;
      const videoCount = req.files?.video?.length || 0;
      console.log(`[createTicketWithImage] Images: ${imageCount}, Video: ${videoCount}`);
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
      const systemType = body.systemType || body.system_type || null;
      const systemNumber = body.systemNumber || body.system_number || null;
      let latitude = parseFloat(body.latitude);
      let longitude = parseFloat(body.longitude);
      if (isNaN(latitude)) latitude = null;
      if (isNaN(longitude)) longitude = null;

      let assignedTo = null;
      if (latitude != null && longitude != null) {
        assignedTo = await findNearestEngineer(latitude, longitude);
      }

      // Handle multiple images and video from upload.fields()
      let imagePaths = [];
      let videoPath = null;
      
      // req.files is an object when using upload.fields()
      // { images: [file1, file2...], video: [file] }
      if (req.files && typeof req.files === 'object') {
        // Handle images array
        if (req.files.images && Array.isArray(req.files.images)) {
          imagePaths = req.files.images.map(file => file.filename);
        }
        // Handle video (single file in array)
        if (req.files.video && Array.isArray(req.files.video) && req.files.video.length > 0) {
          videoPath = req.files.video[0].filename;
        }
      }
      // Fallback for legacy single file upload
      else if (req.file) {
        const ext = path.extname(req.file.originalname || req.file.filename).toLowerCase();
        const videoExts = ['.mp4', '.mov', '.avi', '.mkv', '.webm'];
        
        if (videoExts.includes(ext)) {
          videoPath = req.file.filename;
        } else {
          imagePaths = [req.file.filename];
        }
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
        videoPath: videoPath, // Store video path
        systemType,
        systemNumber,
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

      // Prepare detailed ticket info for notifications
      const customerPhoneRaw = user?.phone || null;
      const siteAddress = user?.site_address || user?.siteAddress || '';
      
      // Get engineer name for customer notification if assigned
      let assignedToName = '';
      if (assignedTo) {
        const engineer = await User.findById(assignedTo);
        assignedToName = engineer?.name || '';
      }
      
      // Build detailed ticket details
      const ticketDetails = {
        title: title || '',
        priority: priority || 'medium',
        category: category || 'General',
        description: description || '',
        assignedToName: assignedToName,
        customerPhone: customerPhoneRaw || '',
        customerEmail: customerEmail || '',
        siteAddress: siteAddress || '',
        latitude: latitude !== undefined ? latitude : null,
        longitude: longitude !== undefined ? longitude : null,
        actionType: 'created',
        hasImages: imagePaths.length > 0
      };

      try {
        emitTicketCreated(ticket);
      } catch (socketError) {
        console.error('[Socket] Error emitting ticket created:', socketError.message);
      }
      
      // Send notifications asynchronously - don't let notification errors fail the ticket creation
      setImmediate(async () => {
        try {
          // FCM notifications
          TicketController.sendCreateNotifications(ticket).catch((e) => {
            console.error('[FCM] create-with-image notification error:', e.message);
          });

          // 1. Send detailed acknowledgment to customer via WhatsApp and Email
          if (phoneNumber) {
            sendWhatsApp(phoneNumber, customerName, serviceId, category, ticketDetails).catch((error) => {
              console.error('[WhatsApp] Failed to send customer acknowledgment:', error.message);
            });
          }
          if (customerEmail) {
            sendEmail(customerEmail, customerName, serviceId, category, ticketDetails).catch((error) => {
              console.error('[Email] Failed to send customer acknowledgment:', error.message);
            });
          }

          // 2. Notify all admins about new ticket with full details
          const admins = await User.getAll({ role: 'admin' });
          for (const admin of admins) {
            const adminPhone = admin.phone ? formatPhoneNumber(admin.phone) : null;
            const adminEmail = admin.email || null;
            const adminName = admin.name || 'Admin';
            if (adminPhone) {
              sendAdminTicketNotification(adminPhone, adminName, serviceId, ticket.status, customerName, ticketDetails).catch((e) => {
                console.error('[WhatsApp] Failed to send admin new ticket notification:', e.message);
              });
            }
            if (adminEmail) {
              sendAdminTicketEmail(adminEmail, adminName, serviceId, ticket.status, customerName, ticketDetails).catch((e) => {
                console.error('[Email] Failed to send admin new ticket notification:', e.message);
              });
            }
          }

          // 3. If auto-assigned, notify the engineer with full details
          if (assignedTo) {
            const engineer = await User.findById(assignedTo);
            if (engineer) {
              const engineerPhone = engineer.phone ? formatPhoneNumber(engineer.phone) : null;
              const engineerEmail = engineer.email || null;
              const engineerName = engineer.name || 'Engineer';
              if (engineerPhone) {
                sendEngineerAssignmentNotification(engineerPhone, engineerName, serviceId, customerName, category, ticketDetails).catch((e) => {
                  console.error('[WhatsApp] Failed to send engineer assignment notification:', e.message);
                });
              }
              if (engineerEmail) {
                sendEngineerAssignmentEmail(engineerEmail, engineerName, serviceId, customerName, category, ticketDetails).catch((e) => {
                  console.error('[Email] Failed to send engineer assignment email:', e.message);
                });
              }
            }
          }

          console.log('[Notifications] Sent detailed WhatsApp and email notifications to all related users for new ticket:', serviceId);
        } catch (notificationError) {
          console.error('[Notifications] Error in notification process:', notificationError.message);
        }
      });

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
        const result = await sendOtpWhatsApp(phone, user.name || 'Customer', otp, 'ticket-completion');
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

      // Send WhatsApp + email notifications to all related users (customer, engineer, admins)
      sendTicketUpdateNotifications(ticket, 'assignment');
      
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
