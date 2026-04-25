/**
 * Firebase Cloud Messaging Service - Production-Ready Implementation
 * 
 * CRITICAL: This service is optimized for KILLED-STATE notifications.
 * 
 * For React Native apps, the notification payload structure MUST include:
 * 1. 'notification' field - Required for Android to show when app is killed
 * 2. 'data' field - Custom data for app handling
 * 3. 'android.priority: high' - Bypass Doze mode
 * 4. 'apns.headers.apns-priority: 10' - Immediate iOS delivery
 * 
 * @module fcmService
 */

const NotificationToken = require('../models/NotificationToken');
const User = require('../models/User');

let firebaseAdmin = null;
let firebaseApp = null;

/**
 * Initialize Firebase Admin SDK
 * Call this once when server starts
 */
function initializeFirebase() {
  if (firebaseApp) return firebaseApp;

  try {
    firebaseAdmin = require('firebase-admin');
  } catch (err) {
    console.error('[FCM] Firebase Admin SDK not installed:', err.message);
    return null;
  }

  // Check if already initialized
  if (firebaseAdmin.apps && firebaseAdmin.apps.length > 0) {
    firebaseApp = firebaseAdmin.apps[0];
    return firebaseApp;
  }

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!serviceAccountJson) {
    console.error('[FCM] FIREBASE_SERVICE_ACCOUNT_JSON not configured in environment');
    return null;
  }

  try {
    const credentials = JSON.parse(serviceAccountJson);
    firebaseApp = firebaseAdmin.initializeApp({
      credential: firebaseAdmin.credential.cert(credentials),
    });
    console.log('[FCM] Firebase Admin initialized successfully');
    return firebaseApp;
  } catch (error) {
    console.error('[FCM] Failed to initialize Firebase:', error.message);
    return null;
  }
}

/**
 * Get Firebase Admin instance
 */
function getAdmin() {
  if (!firebaseAdmin) initializeFirebase();
  return firebaseAdmin;
}

/**
 * Get Firebase App instance
 */
function getApp() {
  if (!firebaseApp) initializeFirebase();
  return firebaseApp;
}

/**
 * Notification Types
 */
const NotificationTypes = {
  TICKET_ASSIGNED: 'TICKET_ASSIGNED',
  TICKET_CREATED: 'TICKET_CREATED',
  TICKET_UPDATED: 'TICKET_UPDATED',
  TICKET_RESOLVED: 'TICKET_RESOLVED',
  ADMIN_REPLY: 'ADMIN_REPLY',
  VISIT_REMINDER: 'VISIT_REMINDER',
  GENERAL: 'GENERAL'
};

/**
 * Notification Channels (must match client-side channels)
 */
const Channels = {
  HIGH_PRIORITY: 'high-priority',
  NORMAL: 'normal-updates',
  REMINDERS: 'reminders'
};

/**
 * Build FCM message payload optimized for killed-state delivery
 * 
 * @param {string} token - FCM device token
 * @param {Object} options - Notification options
 * @returns {Object} FCM message object
 */
function buildMessage(token, options) {
  const {
    title,
    body,
    type = NotificationTypes.GENERAL,
    data = {},
    channel = Channels.NORMAL,
    priority = 'high'
  } = options;

  const isHighPriority = priority === 'high' || channel === Channels.HIGH_PRIORITY;

  // Ensure all data values are strings (FCM requirement)
  const stringifiedData = Object.entries(data).reduce((acc, [key, value]) => {
    acc[key] = String(value);
    return acc;
  }, {});

  return {
    token: token,
    
    // CRITICAL: notification field REQUIRED for killed-state on Android
    notification: {
      title: String(title),
      body: String(body),
    },
    
    // Data payload for app handling
    data: {
      ...stringifiedData,
      type: String(type),
      title: String(title),
      body: String(body),
      channelId: String(channel),
      click_action: 'OPEN_TICKET',
      sentAt: String(Date.now()),
    },
    
    // Android configuration
    android: {
      priority: isHighPriority ? 'high' : 'normal',
      ttl: isHighPriority ? 86400 : 3600, // 24 hours or 1 hour
      directBootOk: true,
      notification: {
        channelId: String(channel),
        sound: 'default',
        priority: isHighPriority ? 'high' : 'default',
        visibility: 'public',
        sticky: false,
      },
    },
    
    // iOS/APNs configuration
    apns: {
      headers: {
        'apns-priority': isHighPriority ? '10' : '5',
        'apns-expiration': String(Math.floor(Date.now() / 1000) + 86400),
        'apns-topic': process.env.IOS_BUNDLE_ID || 'com.nextstepsupportapp',
      },
      payload: {
        aps: {
          alert: {
            title: String(title),
            body: String(body),
          },
          sound: 'default',
          badge: 1,
          'content-available': 1,
          'mutable-content': 1,
          category: 'TICKET_NOTIFICATION',
        },
      },
    },
  };
}

/**
 * Send push notification to a single device
 * 
 * @param {string} token - FCM device token
 * @param {Object} options - Notification options
 * @returns {Promise<Object>} Send result
 */
async function sendPushNotification(token, options) {
  const admin = getAdmin();
  if (!admin) {
    console.error('[FCM] Firebase not initialized');
    return { success: false, error: 'Firebase not initialized' };
  }

  if (!token) {
    return { success: false, error: 'No token provided' };
  }

  try {
    const message = buildMessage(token, options);
    const response = await admin.messaging().send(message);
    
    console.log(`[FCM] ✓ Sent to ${token.substring(0, 20)}...: ${response}`);
    
    return {
      success: true,
      messageId: response,
      token: token.substring(0, 20) + '...'
    };
  } catch (error) {
    console.error(`[FCM] ✗ Send failed:`, error.message);
    
    // Handle specific error codes
    if (error.code === 'messaging/registration-token-not-registered') {
      return { 
        success: false, 
        error: 'Invalid token - device unregistered',
        code: error.code,
        shouldRemove: true 
      };
    }
    
    if (error.code === 'messaging/invalid-registration-token') {
      return { 
        success: false, 
        error: 'Invalid token format',
        code: error.code,
        shouldRemove: true 
      };
    }
    
    return { 
      success: false, 
      error: error.message,
      code: error.code 
    };
  }
}

/**
 * Send to multiple tokens
 * 
 * @param {string[]} tokens - Array of FCM tokens
 * @param {Object} options - Notification options
 * @returns {Promise<Object>} Batch send results
 */
async function sendToMultiple(tokens, options) {
  const admin = getAdmin();
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

  const results = {
    successCount: 0,
    failureCount: 0,
    invalidTokens: [],
    responses: []
  };

  // Send to each token individually for better error handling
  const promises = uniqueTokens.map(async (token) => {
    const result = await sendPushNotification(token, options);
    return { token, ...result };
  });

  const responses = await Promise.all(promises);

  responses.forEach((resp) => {
    if (resp.success) {
      results.successCount++;
    } else {
      results.failureCount++;
      if (resp.shouldRemove) {
        results.invalidTokens.push(resp.token);
      }
    }
    results.responses.push(resp);
  });

  // Clean up invalid tokens
  if (results.invalidTokens.length > 0) {
    await cleanupInvalidTokens(results.invalidTokens);
  }

  console.log(`[FCM] Batch complete: ${results.successCount} success, ${results.failureCount} failed`);
  
  return results;
}

/**
 * Send notification to users by their IDs
 * 
 * @param {number[]} userIds - Array of user IDs
 * @param {Object} options - Notification options
 * @returns {Promise<Object>} Send results
 */
async function sendToUsers(userIds, options) {
  if (!Array.isArray(userIds) || userIds.length === 0) {
    return { successCount: 0, failureCount: 0, error: 'No user IDs provided' };
  }

  const tokens = await NotificationToken.getTokensByUserIds(userIds);
  
  if (tokens.length === 0) {
    console.log(`[FCM] No tokens found for users: ${userIds.join(', ')}`);
    return { successCount: 0, failureCount: 0, error: 'No tokens found' };
  }

  return sendToMultiple(tokens, options);
}

/**
 * Send notification to users by roles
 * 
 * @param {string[]} roles - Array of roles
 * @param {Object} options - Notification options
 * @returns {Promise<Object>} Send results
 */
async function sendToRoles(roles, options) {
  if (!Array.isArray(roles) || roles.length === 0) {
    return { successCount: 0, failureCount: 0, error: 'No roles provided' };
  }

  const tokens = await NotificationToken.getTokensByRoles(roles);
  
  if (tokens.length === 0) {
    console.log(`[FCM] No tokens found for roles: ${roles.join(', ')}`);
    return { successCount: 0, failureCount: 0, error: 'No tokens found' };
  }

  return sendToMultiple(tokens, options);
}

/**
 * Send ticket assignment notification
 * This is the main function for your use case
 * 
 * @param {number} engineerId - Engineer user ID
 * @param {Object} ticket - Ticket object
 * @returns {Promise<Object>} Send result
 */
async function sendTicketAssignedNotification(engineerId, ticket) {
  const serviceId = `NXP-SVC-${String(ticket.id).padStart(6, '0')}`;
  
  const options = {
    title: 'Complaint Assigned',
    body: `${serviceId} has been assigned to you`,
    type: NotificationTypes.TICKET_ASSIGNED,
    channel: Channels.HIGH_PRIORITY,
    priority: 'high',
    data: {
      ticketId: String(ticket.id),
      serviceId: serviceId,
      screen: 'TicketDetails',
      status: ticket.status || 'assigned',
      priority: ticket.priority || 'medium',
    }
  };

  console.log(`[FCM] Sending assignment notification to engineer ${engineerId} for ticket ${serviceId}`);
  
  return sendToUsers([engineerId], options);
}

/**
 * Clean up invalid tokens from database
 * 
 * @param {string[]} invalidTokens - Array of invalid tokens
 */
async function cleanupInvalidTokens(invalidTokens) {
  if (!invalidTokens || invalidTokens.length === 0) return;

  console.log(`[FCM] Cleaning up ${invalidTokens.length} invalid tokens...`);

  for (const token of invalidTokens) {
    try {
      // Remove from database - you'll need to add this method to NotificationToken model
      await NotificationToken.unregisterByToken(token);
      console.log(`[FCM] Removed invalid token: ${token.substring(0, 20)}...`);
    } catch (error) {
      console.error('[FCM] Failed to remove token:', error.message);
    }
  }
}

/**
 * Test notification
 * 
 * @param {string} token - Device token to test
 * @returns {Promise<Object>} Test result
 */
async function sendTestNotification(token) {
  return sendPushNotification(token, {
    title: '🔔 Test Notification',
    body: 'If you see this, FCM is working correctly!',
    type: NotificationTypes.GENERAL,
    channel: Channels.HIGH_PRIORITY,
    priority: 'high',
    data: {
      test: 'true',
      screen: 'Home'
    }
  });
}

// Initialize on module load
initializeFirebase();

module.exports = {
  // Core functions
  initializeFirebase,
  sendPushNotification,
  sendToMultiple,
  sendToUsers,
  sendToRoles,
  
  // High-level functions
  sendTicketAssignedNotification,
  sendTestNotification,
  cleanupInvalidTokens,
  
  // Constants
  NotificationTypes,
  Channels,
  
  // Internal (for testing)
  buildMessage,
};
