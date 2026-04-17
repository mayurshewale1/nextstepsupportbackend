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

/**
 * Send FCM notification to tokens
 *
 * CRITICAL: Must include BOTH notification AND data payload
 * - notification: System displays this when app is killed (REQUIRED for killed state)
 * - data: App receives this when user taps notification (for navigation)
 * - android.priority: "high" = head-up notification (pop-up)
 * - android.directBootAware: true = deliver even before user unlocks device
 *
 * WHY DATA-ONLY MESSAGES FAIL IN KILLED STATE:
 * - Data-only messages require the app to process them
 * - When app is killed, Android won't start the app to process data messages
 * - High priority + notification payload = system displays notification directly
 *
 * PAYLOAD STRUCTURE FOR KILLED STATE RELIABILITY:
 * {
 *   notification: { title, body },  // System displays this
 *   data: { chatId, type, userId }, // App gets this on tap
 *   android: {
 *     priority: "high",
 *     notification: { channelId: "high-priority" }
 *   }
 * }
 */
async function sendToTokens(tokens, payload) {
  const admin = initFirebaseApp();
  if (!admin) return { successCount: 0, failureCount: 0, disabled: true };

  const deduped = [...new Set((tokens || []).filter(Boolean))];
  if (deduped.length === 0) return { successCount: 0, failureCount: 0 };

  // Convert all data values to strings (FCM requires string values in data payload)
  const stringifiedData = {};
  if (payload.data) {
    for (const [key, value] of Object.entries(payload.data)) {
      stringifiedData[key] = String(value);
    }
  }

  // CRITICAL: Must include notification object for killed state
  // System displays this when app is killed - JS handler won't run
  const message = {
    tokens: deduped,
    notification: {
      title: payload.notification?.title || 'NextStep',
      body: payload.notification?.body || 'You have a new update',
    },
    data: {
      ...stringifiedData,
      // Add click_action for Android to open MainActivity
      click_action: 'FLUTTER_NOTIFICATION_CLICK',
    },
    android: {
      priority: 'high', // REQUIRED for head-up notification (pop-up)
      directBootAware: true, // Deliver notification before device unlock
      notification: {
        channelId: 'high-priority', // Must match client channel ID
        sound: 'default',
        priority: 'high', // Head-up notification priority
        visibility: 'public', // Show on lock screen
        sticky: false,
        localOnly: false,
        // REQUIRED for Chinese OEMs (Xiaomi, Vivo, Oppo, Realme)
        vibrateTimings: ['200ms', '100ms', '200ms'],
        notificationCount: 1,
        // Ensure notification wakes screen
        ticker: payload.notification?.body || 'New notification',
      },
    },
    apns: {
      headers: {
        'apns-priority': '10', // REQUIRED for iOS immediate delivery
      },
      payload: {
        aps: {
          sound: 'default',
          badge: 1,
          'content-available': 1, // REQUIRED for background processing
          'mutable-content': 1,
        },
      },
    },
  };

  try {
    const result = await admin.messaging().sendEachForMulticast(message);
    
    // Clean up invalid tokens
    if (result.failureCount > 0) {
      result.responses.forEach((resp, idx) => {
        if (!resp.success) {
          console.error(`[FCM] Failed to send to token ${deduped[idx].substring(0, 20)}...:`, resp.error?.message);
          // Log invalid tokens for cleanup
          if (resp.error?.code === 'messaging/registration-token-not-registered') {
            console.log(`[FCM] Token should be removed from DB: ${deduped[idx].substring(0, 20)}...`);
          }
        }
      });
    }
    
    console.log(`[FCM] Sent: ${result.successCount} success, ${result.failureCount} failed`);
    return { successCount: result.successCount, failureCount: result.failureCount };
  } catch (error) {
    console.error('[FCM] Send error:', error.message);
    return { successCount: 0, failureCount: deduped.length, error: error.message };
  }
}

/**
 * Send chat message notification
 * Optimized for killed-state delivery with chat navigation data
 */
async function sendChatNotification(tokens, chatId, senderName, message, senderId) {
  return sendToTokens(tokens, {
    notification: {
      title: senderName || 'New Message',
      body: message || 'You have a new message',
    },
    data: {
      type: 'chat_message',
      chatId: String(chatId),
      senderId: String(senderId),
      senderName: String(senderName || ''),
      message: String(message || ''),
      timestamp: String(Date.now()),
    },
  });
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
  sendToTokens,
  sendChatNotification,
  notifyRoles,
  notifyUsers,
  notifyUsersAndAreaHeads,
};
