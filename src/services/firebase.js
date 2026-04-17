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

  const message = {
    tokens: deduped,
    notification: payload.notification,
    data: payload.data || {},
    android: {
      priority: 'high',
      notification: {
        channelId: 'high-priority',
        sound: 'default',
        priority: 'high',
        visibility: 'public',
        // Ensure pop-up notification
        sticky: false,
        localOnly: false,
      },
    },
    apns: {
      headers: {
        'apns-priority': '10',
      },
      payload: {
        aps: {
          sound: 'default',
          badge: 1,
          // Ensure pop-up notification
          'content-available': 1,
          'mutable-content': 1,
        },
      },
    },
  };

  const result = await admin.messaging().sendEachForMulticast(message);
  return { successCount: result.successCount, failureCount: result.failureCount };
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
