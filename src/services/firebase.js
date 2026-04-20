/**
 * Firebase Cloud Messaging Service
 * 
 * CRITICAL: For notifications to work when app is KILLED (removed from recent apps),
 * you MUST include the "notification" field in the payload. 
 * 
 * Data-only payloads will NOT trigger notifications in killed state!
 * 
 * Payload structure:
 * {
 *   notification: {  // <-- REQUIRED for killed-state notifications
 *     title: '...',
 *     body: '...'
 *   },
 *   data: {           // <-- Custom data for app handling
 *     ticketId: '...',
 *     type: '...'
 *   },
 *   android: {
 *     priority: 'high',
 *     notification: {
 *       channelId: 'high-priority',
 *       priority: 'high',
 *       visibility: 'public'
 *     }
 *   },
 *   apns: {
 *     headers: { 'apns-priority': '10' }
 *   }
 * }
 */
const NotificationToken = require('../models/NotificationToken');
const User = require('../models/User');

let firebaseAdmin = null;

function getFirebaseAdmin() {
  if (firebaseAdmin) return firebaseAdmin;
  try {
    firebaseAdmin = require('firebase-admin');
  } catch {
    return null;
  }
  return firebaseAdmin;
}

function initFirebaseApp() {
  const admin = getFirebaseAdmin();
  if (!admin) return null;

  if (admin.apps && admin.apps.length > 0) return admin;

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;

  try {
    const credentials = JSON.parse(raw);
    admin.initializeApp({
      credential: admin.credential.cert(credentials),
    });
    return admin;
  } catch (e) {
    console.error('[FCM] Failed to initialize Firebase app:', e.message);
    return null;
  }
}

async function sendToTokens(tokens, payload) {
  const admin = initFirebaseApp();
  if (!admin) return { successCount: 0, failureCount: 0, disabled: true };

  const deduped = [...new Set((tokens || []).filter(Boolean))];
  if (deduped.length === 0) return { successCount: 0, failureCount: 0 };

  /**
   * IMPORTANT FCM Payload Structure for Killed-State Support:
   * 
   * 1. notification field: REQUIRED for Android system to show notification
   *    when app is killed. Without this, no notification appears!
   * 
   * 2. data field: Optional custom data passed to app when notification is tapped
   * 
   * 3. android.priority: 'high' - Ensures immediate delivery even in Doze mode
   * 
   * 4. android.notification.channelId: Must match client-side channel ('high-priority')
   * 
   * 5. apns.headers.apns-priority: '10' - Immediate delivery for iOS
   */
  const message = {
    tokens: deduped,
    // REQUIRED: This is what Android displays when app is killed
    notification: {
      title: payload.notification?.title || 'NextStep',
      body: payload.notification?.body || 'You have a new update',
      // Android-specific notification fields
      imageUrl: payload.notification?.imageUrl, // Optional: Big picture
    },
    // Custom data for app to handle when notification is tapped
    data: {
      ...(payload.data || {}),
      // Ensure all data values are strings (FCM requirement)
      ticketId: String(payload.data?.ticketId || ''),
      type: String(payload.data?.type || ''),
      click_action: 'FLUTTER_NOTIFICATION_CLICK', // For compatibility
    },
    android: {
      // High priority ensures delivery even in Doze mode
      priority: 'high',
      // Time-to-live: 24 hours (in seconds)
      ttl: 86400,
      notification: {
        // Must match the channel ID created in client
        channelId: 'high-priority',
        sound: 'default',
        // High priority for heads-up notification
        priority: 'high',
        // Public visibility shows on lock screen
        visibility: 'public',
        // Don't make it sticky (user can dismiss)
        sticky: false,
        // Allow notification to be shown immediately
        localOnly: false,
        // Enable notification dot on app icon
        notificationCount: 1,
      },
      // Direct boot mode - deliver even if device is locked after restart
      directBootOk: true,
    },
    apns: {
      headers: {
        // Priority 10 = Immediate delivery
        'apns-priority': '10',
        // Expiration: 1 day
        'apns-expiration': String(Math.floor(Date.now() / 1000) + 86400),
      },
      payload: {
        aps: {
          alert: {
            title: payload.notification?.title,
            body: payload.notification?.body,
          },
          sound: 'default',
          badge: 1,
          // Content available for background processing
          'content-available': 1,
          // Allow mutable content for rich notifications
          'mutable-content': 1,
          // Category for action buttons
          category: 'TICKET_NOTIFICATION',
        },
      },
    },
  };

  try {
    console.log('[FCM] Sending notification to', deduped.length, 'tokens');
    const result = await admin.messaging().sendEachForMulticast(message);
    
    // Log any failures for debugging
    if (result.failureCount > 0) {
      result.responses.forEach((resp, idx) => {
        if (!resp.success) {
          console.error(`[FCM] Failed to send to token ${idx}:`, resp.error?.message);
        }
      });
    }
    
    console.log(`[FCM] Send complete: ${result.successCount} success, ${result.failureCount} failures`);
    return { 
      successCount: result.successCount, 
      failureCount: result.failureCount,
      responses: result.responses 
    };
  } catch (error) {
    console.error('[FCM] Error sending multicast:', error);
    return { successCount: 0, failureCount: deduped.length, error: error.message };
  }
}

async function notifyRoles(roles, payload) {
  const tokens = await NotificationToken.getTokensByRoles(roles);
  return sendToTokens(tokens, payload);
}

async function notifyUsers(userIds, payload) {
  // Get tokens for the target users
  const tokens = await NotificationToken.getTokensByUserIds(userIds);

  // Also get area head IDs for these users and notify them too
  const areaHeadIds = await User.getAreaHeadIdsForUsers(userIds);
  if (areaHeadIds.length > 0) {
    const areaHeadTokens = await NotificationToken.getTokensByUserIds(areaHeadIds);
    // Merge area head tokens with user tokens
    tokens.push(...areaHeadTokens);
  }

  return sendToTokens(tokens, payload);
}

async function notifyUsersAndAreaHeads(userIds, payload, includeAreaHeads = true) {
  // Get tokens for the target users
  const userTokens = await NotificationToken.getTokensByUserIds(userIds);

  let allTokens = [...userTokens];

  // Also notify area heads if requested
  if (includeAreaHeads && userIds.length > 0) {
    const areaHeadIds = await User.getAreaHeadIdsForUsers(userIds);
    if (areaHeadIds.length > 0) {
      const areaHeadTokens = await NotificationToken.getTokensByUserIds(areaHeadIds);
      allTokens = [...new Set([...allTokens, ...areaHeadTokens])];
    }
  }

  return sendToTokens(allTokens, payload);
}

module.exports = {
  notifyRoles,
  notifyUsers,
  notifyUsersAndAreaHeads,
};
