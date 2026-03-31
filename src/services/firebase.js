const NotificationToken = require('../models/NotificationToken');

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
    android: { priority: 'high' },
  };

  const result = await admin.messaging().sendEachForMulticast(message);
  return { successCount: result.successCount, failureCount: result.failureCount };
}

async function notifyRoles(roles, payload) {
  const tokens = await NotificationToken.getTokensByRoles(roles);
  return sendToTokens(tokens, payload);
}

async function notifyUsers(userIds, payload) {
  const tokens = await NotificationToken.getTokensByUserIds(userIds);
  return sendToTokens(tokens, payload);
}

module.exports = {
  notifyRoles,
  notifyUsers,
};
