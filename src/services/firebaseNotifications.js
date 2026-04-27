/**
 * Firebase Cloud Messaging Service - Killed-State Optimized
 * 
 * PRODUCTION-GRADE notification service for NextStep Support App
 * 
 * CRITICAL: This service uses the FCM multicast API with optimized payloads
 * to ensure notifications arrive even when the app is removed from recent apps.
 * 
 * Architecture:
 * - Notification + Data payload structure (required for killed-state)
 * - High priority for immediate delivery
 * - Channel-based routing (high-priority, normal-updates, reminders)
 * - Optimized for Chinese OEMs (Xiaomi, Vivo, Oppo, Realme, Samsung)
 * 
 * @module firebaseNotifications
 */

const NotificationToken = require('../models/NotificationToken');
const User = require('../models/User');

let firebaseAdmin = null;

/**
 * Initialize Firebase Admin SDK
 */
function getFirebaseAdmin() {
  if (firebaseAdmin) return firebaseAdmin;
  
  try {
    firebaseAdmin = require('firebase-admin');
  } catch (err) {
    console.error('[FCM] Firebase Admin SDK not installed');
    return null;
  }
  
  return firebaseAdmin;
}

/**
 * Initialize Firebase App with service account
 */
function initFirebaseApp() {
  const admin = getFirebaseAdmin();
  if (!admin) return null;

  // Already initialized
  if (admin.apps && admin.apps.length > 0) {
    return admin.apps[0];
  }

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!serviceAccountJson) {
    console.error('[FCM] FIREBASE_SERVICE_ACCOUNT_JSON not configured');
    return null;
  }

  try {
    const credentials = JSON.parse(serviceAccountJson);
    const app = admin.initializeApp({
      credential: admin.credential.cert(credentials),
    });
    console.log('[FCM] Firebase Admin initialized successfully');
    return app;
  } catch (error) {
    console.error('[FCM] Failed to initialize Firebase:', error.message);
    return null;
  }
}

/**
 * NOTIFICATION TYPES
 */
const NotificationTypes = {
  TICKET_CREATED: 'ticket_created',
  TICKET_ASSIGNED: 'ticket_assigned',
  TICKET_UPDATED: 'ticket_updated',
  ADMIN_REPLY: 'admin_reply',
  TICKET_RESOLVED: 'ticket_resolved',
  VISIT_REMINDER: 'visit_reminder',
  URGENT_ALERT: 'urgent_alert',
  ANNOUNCEMENT: 'announcement'
};

/**
 * NOTIFICATION CHANNELS
 */
const Channels = {
  HIGH_PRIORITY: 'high-priority',
  NORMAL: 'normal-updates',
  REMINDERS: 'reminders'
};

/**
 * DEFAULT NOTIFICATION CONTENT
 */
const DefaultContent = {
  [NotificationTypes.TICKET_CREATED]: {
    title: '🎫 New Ticket Created',
    body: (data) => `Ticket #${data.ticketId}: A new support ticket has been created.`,
    channel: Channels.HIGH_PRIORITY
  },
  [NotificationTypes.TICKET_ASSIGNED]: {
    title: '👤 Ticket Assigned',
    body: (data) => `Ticket #${data.ticketId}: Assigned to ${data.engineerName || 'an engineer'}`,
    channel: Channels.NORMAL
  },
  [NotificationTypes.TICKET_UPDATED]: {
    title: '📝 Ticket Updated',
    body: (data) => `Ticket #${data.ticketId}: Status updated to ${data.status || 'new status'}`,
    channel: Channels.NORMAL
  },
  [NotificationTypes.ADMIN_REPLY]: {
    title: '💬 Admin Reply',
    body: (data) => `Ticket #${data.ticketId}: New message from admin team`,
    channel: Channels.HIGH_PRIORITY
  },
  [NotificationTypes.TICKET_RESOLVED]: {
    title: '✅ Ticket Resolved',
    body: (data) => `Ticket #${data.ticketId}: Your issue has been resolved!`,
    channel: Channels.NORMAL
  },
  [NotificationTypes.VISIT_REMINDER]: {
    title: '⏰ Visit Reminder',
    body: (data) => `Engineer visit scheduled ${data.visitTime ? `at ${data.visitTime}` : 'soon'}`,
    channel: Channels.REMINDERS
  },
  [NotificationTypes.URGENT_ALERT]: {
    title: '🚨 Urgent Support Alert',
    body: (data) => data.message || 'Immediate attention required for your support request',
    channel: Channels.HIGH_PRIORITY
  },
  [NotificationTypes.ANNOUNCEMENT]: {
    title: '📢 Announcement',
    body: (data) => data.message || 'Important update from NextStep',
    channel: Channels.NORMAL
  }
};

/**
 * Build FCM message payload optimized for killed-state delivery
 * 
 * CRITICAL: Must include 'notification' field for Android to display when app is killed!
 * Data-only messages will NOT show when app is removed from recent apps.
 * 
 * @param {string} token - FCM device token
 * @param {Object} payload - Notification payload
 * @returns {Object} FCM message object
 */
function buildMessage(token, payload) {
  const type = payload.type || NotificationTypes.TICKET_UPDATED;
  const content = DefaultContent[type] || DefaultContent[NotificationTypes.TICKET_UPDATED];
  const data = payload.data || {};
  
  // Build title and body
  const title = payload.title || content.title;
  const body = payload.body || content.body(data);
  
  // Determine channel
  const channelId = payload.channel || content.channel;
  
  // Determine priority
  const isHighPriority = channelId === Channels.HIGH_PRIORITY;
  
  /**
   * CRITICAL FCM PAYLOAD STRUCTURE FOR KILLED-STATE SUPPORT:
   * 
   * 1. notification field: REQUIRED! Android OS displays this when app is killed.
   *    Without this, NO NOTIFICATION appears when app is swiped away!
   * 
   * 2. data field: Custom data passed to app when user taps notification.
   * 
   * 3. android.priority: 'high' bypasses Doze mode and App Standby.
   * 
   * 4. android.notification.channelId: Must match client-side channel.
   * 
   * 5. apns.payload.aps.alert: iOS needs this to show notifications.
   */
  const message = {
    token: token,
    
    // REQUIRED: This is what Android displays when app is killed
    notification: {
      title: String(title),
      body: String(body),
    },
    
    // Data payload for app handling when notification is tapped
    data: {
      // Ensure all values are strings (FCM requirement)
      title: String(title),
      body: String(body),
      type: String(type),
      ticketId: String(data.ticketId || ''),
      status: String(data.status || ''),
      engineerName: String(data.engineerName || ''),
      message: String(data.message || ''),
      priority: String(data.priority || 'normal'),
      channelId: String(channelId),
      screen: String(data.screen || 'TicketDetails'),
      click_action: 'OPEN_TICKET',
      // Add timestamp for tracking
      sentAt: String(Date.now()),
      // Server-side tracking
      serverMessageId: payload.messageId || `msg_${Date.now()}`
    },
    
    // Android configuration
    android: {
      // High priority for immediate delivery even in Doze mode
      priority: isHighPriority ? 'high' : 'normal',
      // TTL: 24 hours for urgent, 1 hour for normal
      ttl: isHighPriority ? 86400 : 3600,
      // Direct boot mode - deliver even if device locked after restart
      directBootOk: true,
      // Android notification configuration
      notification: {
        // Must match the channel ID created in client
        channelId: String(channelId),
        sound: 'default',
        // High priority for heads-up notification
        priority: isHighPriority ? 'high' : 'default',
        // Public visibility shows on lock screen
        visibility: 'public',
        // Don't make it sticky (user can dismiss)
        sticky: false,
      }
    },
    
    // iOS configuration (APNs)
    apns: {
      headers: {
        // Priority 10 = Immediate delivery
        'apns-priority': isHighPriority ? '10' : '5',
        // Expiration: 1 day
        'apns-expiration': String(Math.floor(Date.now() / 1000) + 86400),
        // Topic for proper routing
        'apns-topic': process.env.IOS_BUNDLE_ID || 'com.nextstepsupportapp'
      },
      
      payload: {
        aps: {
          alert: {
            title: title,
            body: body
          },
          sound: 'default',
          badge: 1,
          // Content available for background processing
          'content-available': 1,
          // Mutable content for rich notifications
          'mutable-content': 1,
          // Category for action buttons
          category: 'TICKET_NOTIFICATION',
          // Thread ID for grouping
          threadId: data.ticketId || 'general'
        }
      }
    },
    
    // Web push (if ever needed)
    webpush: {
      headers: {
        TTL: String(isHighPriority ? 86400 : 3600),
        Urgency: isHighPriority ? 'high' : 'normal'
      },
      notification: {
        title: title,
        body: body,
        icon: '/icon.png',
        badge: '/badge.png',
        requireInteraction: isHighPriority
      }
    }
  };
  
  return message;
}

/**
 * Send notification to a single device
 * 
 * @param {string} token - FCM device token
 * @param {Object} payload - Notification payload
 * @returns {Promise<Object>} Send result
 */
async function sendToToken(token, payload) {
  const admin = initFirebaseApp();
  if (!admin) {
    return { success: false, error: 'Firebase not initialized' };
  }
  
  if (!token) {
    return { success: false, error: 'No token provided' };
  }
  
  try {
    const message = buildMessage(token, payload);
    
    console.log(`[FCM] Sending ${payload.type} to token: ${token.substring(0, 20)}...`);
    
    const response = await admin.messaging().send(message);
    
    console.log(`[FCM] ✓ Sent successfully: ${response}`);
    
    return {
      success: true,
      messageId: response,
      token: token.substring(0, 20) + '...'
    };
    
  } catch (error) {
    console.error(`[FCM] ✗ Send failed:`, error.message);
    
    // Handle specific error codes
    if (error.code === 'messaging/registration-token-not-registered') {
      // Token is invalid, should be removed from database
      return { success: false, error: 'Invalid token', shouldRemove: true };
    }
    
    return { success: false, error: error.message };
  }
}

/**
 * Send notification to multiple devices
 * 
 * @param {string[]} tokens - Array of FCM device tokens
 * @param {Object} payload - Notification payload
 * @returns {Promise<Object>} Send results
 */
async function sendToTokens(tokens, payload) {
  const admin = initFirebaseApp();
  if (!admin) {
    return { 
      successCount: 0, 
      failureCount: tokens.length, 
      error: 'Firebase not initialized' 
    };
  }
  
  // Remove duplicates and nulls
  const uniqueTokens = [...new Set(tokens.filter(Boolean))];
  
  if (uniqueTokens.length === 0) {
    return { successCount: 0, failureCount: 0 };
  }
  
  try {
    console.log(`[FCM] Sending ${payload.type} to ${uniqueTokens.length} devices...`);
    
    // Build messages for each token
    const messages = uniqueTokens.map(token => buildMessage(token, payload));
    
    // Send all at once using sendEach (recommended over sendMulticast which is deprecated)
    const response = await admin.messaging().sendEach(messages);
    
    // Process results
    const invalidTokens = [];
    const results = {
      successCount: response.successCount,
      failureCount: response.failureCount,
      responses: response.responses.map((resp, idx) => ({
        token: uniqueTokens[idx].substring(0, 20) + '...',
        success: resp.success,
        messageId: resp.messageId,
        error: resp.error ? resp.error.message : null
      }))
    };
    
    // Collect invalid tokens for cleanup
    response.responses.forEach((resp, idx) => {
      if (!resp.success) {
        if (resp.error && resp.error.code === 'messaging/registration-token-not-registered') {
          invalidTokens.push(uniqueTokens[idx]);
        }
      }
    });
    
    if (invalidTokens.length > 0) {
      results.invalidTokens = invalidTokens;
      console.log(`[FCM] Found ${invalidTokens.length} invalid tokens to remove`);
    }
    
    console.log(`[FCM] ✓ Complete: ${results.successCount} success, ${results.failureCount} failed`);
    
    return results;
    
  } catch (error) {
    console.error('[FCM] ✗ Batch send failed:', error);
    return {
      successCount: 0,
      failureCount: uniqueTokens.length,
      error: error.message
    };
  }
}

/**
 * Send notification to users by their user IDs
 * 
 * @param {number[]} userIds - Array of user IDs
 * @param {Object} payload - Notification payload
 * @param {boolean} includeAreaHeads - Also notify area heads for these users
 * @returns {Promise<Object>} Send results
 */
async function notifyUsers(userIds, payload, includeAreaHeads = true) {
  // Get tokens for target users
  const userTokens = await NotificationToken.getTokensByUserIds(userIds);
  
  let allTokens = [...userTokens];
  
  // Also get area heads if requested
  if (includeAreaHeads && userIds.length > 0) {
    const areaHeadIds = await User.getAreaHeadIdsForUsers(userIds);
    if (areaHeadIds.length > 0) {
      const areaHeadTokens = await NotificationToken.getTokensByUserIds(areaHeadIds);
      allTokens = [...new Set([...allTokens, ...areaHeadTokens])];
    }
  }
  
  return sendToTokens(allTokens, payload);
}

/**
 * Send notification to users by their roles
 * 
 * @param {string[]} roles - Array of roles (e.g., ['admin', 'engineer'])
 * @param {Object} payload - Notification payload
 * @returns {Promise<Object>} Send results
 */
async function notifyByRoles(roles, payload) {
  const tokens = await NotificationToken.getTokensByRoles(roles);
  return sendToTokens(tokens, payload);
}

/**
 * Send notification about ticket update
 * 
 * @param {number} ticketId - Ticket ID
 * @param {string} type - Notification type
 * @param {Object} data - Additional data
 * @returns {Promise<Object>} Send results
 */
async function sendTicketNotification(ticketId, type, data = {}) {
  const payload = {
    type: type,
    data: {
      ticketId: String(ticketId),
      ...data
    }
  };
  
  // Determine who to notify based on type
  let userIds = [];
  
  switch (type) {
    case NotificationTypes.TICKET_CREATED:
      // Notify admins and area heads
      return notifyByRoles(['admin', 'area_head'], payload);
      
    case NotificationTypes.TICKET_ASSIGNED:
      // Notify assigned engineer and user
      if (data.engineerId) userIds.push(data.engineerId);
      if (data.userId) userIds.push(data.userId);
      break;
      
    case NotificationTypes.TICKET_UPDATED:
    case NotificationTypes.ADMIN_REPLY:
    case NotificationTypes.TICKET_RESOLVED:
      // Notify ticket owner and assigned engineer
      if (data.userId) userIds.push(data.userId);
      if (data.engineerId) userIds.push(data.engineerId);
      break;
      
    default:
      // Default: notify provided user IDs
      if (data.userIds) userIds = data.userIds;
  }
  
  if (userIds.length === 0) {
    console.log('[FCM] No users to notify for ticket', ticketId);
    return { successCount: 0, failureCount: 0 };
  }
  
  return notifyUsers(userIds, payload);
}

/**
 * Send urgent alert to admins
 * 
 * @param {string} message - Alert message
 * @param {Object} data - Additional data
 * @returns {Promise<Object>} Send results
 */
async function sendUrgentAlert(message, data = {}) {
  const payload = {
    type: NotificationTypes.URGENT_ALERT,
    title: data.title || '🚨 Urgent Support Alert',
    body: message,
    data: {
      priority: 'high',
      ...data
    },
    channel: Channels.HIGH_PRIORITY
  };
  
  return notifyByRoles(['admin', 'area_head'], payload);
}

/**
 * Send visit reminder
 * 
 * @param {number} userId - User ID
 * @param {string} visitTime - Visit time string
 * @param {Object} data - Additional data
 * @returns {Promise<Object>} Send results
 */
async function sendVisitReminder(userId, visitTime, data = {}) {
  const payload = {
    type: NotificationTypes.VISIT_REMINDER,
    data: {
      userId: String(userId),
      visitTime: visitTime,
      ...data
    },
    channel: Channels.REMINDERS
  };
  
  return notifyUsers([userId], payload);
}

/**
 * Send announcement to all users or specific roles
 * 
 * @param {string} message - Announcement message
 * @param {string[]} roles - Roles to notify (null for all)
 * @param {Object} data - Additional data
 * @returns {Promise<Object>} Send results
 */
async function sendAnnouncement(message, roles = null, data = {}) {
  const payload = {
    type: NotificationTypes.ANNOUNCEMENT,
    title: data.title || '📢 Announcement',
    body: message,
    data: {
      message: message,
      ...data
    }
  };
  
  if (roles) {
    return notifyByRoles(roles, payload);
  }
  
  // Send to all active users
  const tokens = await NotificationToken.getTokensByRoles(['user', 'admin', 'engineer', 'area_head']);
  return sendToTokens(tokens, payload);
}

/**
 * Clean up invalid tokens from database
 * 
 * @param {string[]} invalidTokens - Array of invalid tokens to remove
 */
async function cleanupInvalidTokens(invalidTokens) {
  if (!invalidTokens || invalidTokens.length === 0) return;
  
  console.log(`[FCM] Cleaning up ${invalidTokens.length} invalid tokens...`);
  
  for (const token of invalidTokens) {
    try {
      await NotificationToken.unregisterByToken(token);
      console.log(`[FCM] Removed invalid token: ${token.substring(0, 20)}...`);
    } catch (error) {
      console.error('[FCM] Failed to remove token:', error.message);
    }
  }
}

/**
 * Test notification delivery
 * 
 * @param {string} token - Test device token
 * @returns {Promise<Object>} Test result
 */
async function sendTestNotification(token) {
  const payload = {
    type: NotificationTypes.TICKET_UPDATED,
    title: '🔔 Test Notification',
    body: 'This is a test notification from NextStep Support. If you see this, notifications are working!',
    data: {
      ticketId: 'TEST',
      test: 'true',
      priority: 'high'
    },
    channel: Channels.HIGH_PRIORITY
  };
  
  return sendToToken(token, payload);
}

// Export all functions
module.exports = {
  // Core functions
  initFirebaseApp,
  sendToToken,
  sendToTokens,
  notifyUsers,
  notifyByRoles,
  
  // High-level notification functions
  sendTicketNotification,
  sendUrgentAlert,
  sendVisitReminder,
  sendAnnouncement,
  sendTestNotification,
  
  // Utilities
  cleanupInvalidTokens,
  buildMessage,
  
  // Constants
  NotificationTypes,
  Channels,
  DefaultContent
};

/**
 * Usage Examples:
 * 
 * 1. Send ticket assignment notification:
 *    await sendTicketNotification(123, 'ticket_assigned', {
 *      engineerId: 456,
 *      engineerName: 'John Doe',
 *      userId: 789
 *    });
 * 
 * 2. Send urgent alert to admins:
 *    await sendUrgentAlert('System downtime reported', {
 *      ticketId: 'URGENT-001'
 *    });
 * 
 * 3. Send visit reminder:
 *    await sendVisitReminder(789, 'Tomorrow at 10:00 AM', {
 *      engineerName: 'John Doe'
 *    });
 * 
 * 4. Send announcement to all engineers:
 *    await sendAnnouncement('New procedures effective immediately', ['engineer']);
 * 
 * 5. Test notification:
 *    await sendTestNotification(deviceToken);
 */
