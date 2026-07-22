/**
 * Contract (DLP / AMC / CMC) expiry reminders — 8 days before contract_end_date
 */
const User = require('../models/User');
const {
  notifyUsers,
  notifyByRoles,
  Channels,
} = require('./firebaseNotifications');

const DAYS_AHEAD = 8;
const CHECK_INTERVAL_MS = 60 * 60 * 1000; // hourly

let intervalHandle = null;
let running = false;

function formatDate(d) {
  if (!d) return '';
  const date = d instanceof Date ? d : new Date(d);
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

async function processContractReminders() {
  if (running) return;
  running = true;
  try {
    const dueUsers = await User.findContractRemindersDue(DAYS_AHEAD);
    if (!dueUsers.length) {
      console.log('[ContractReminder] No reminders due today');
      return;
    }

    console.log(`[ContractReminder] Sending ${dueUsers.length} reminder(s)`);

    for (const user of dueUsers) {
      const contractType = String(user.site_type || '').toUpperCase();
      const endDate = formatDate(user.contract_end_date);
      const title = `${contractType} reminder`;
      const body = `${contractType} for ${user.name || user.site_name || 'your site'} ends in ${DAYS_AHEAD} days (${endDate}).`;

      const payload = {
        type: 'contract_reminder',
        title: `⏰ ${title}`,
        body,
        data: {
          userId: String(user.id),
          contractType,
          contractEndDate: String(user.contract_end_date),
          daysAhead: String(DAYS_AHEAD),
          priority: 'high',
        },
        channel: Channels.REMINDERS,
      };

      // Notify the customer
      await notifyUsers([user.id], payload);

      // Notify admins (+ area head if assigned)
      await notifyByRoles(['admin'], {
        ...payload,
        title: `⏰ ${contractType} expiring soon`,
        body: `${user.name || user.email}: ${contractType} ends in ${DAYS_AHEAD} days (${endDate}).`,
      });

      if (user.area_head_id) {
        await notifyUsers([user.area_head_id], {
          ...payload,
          title: `⏰ ${contractType} expiring soon`,
          body: `${user.name || user.email}: ${contractType} ends in ${DAYS_AHEAD} days (${endDate}).`,
        });
      }

      await User.markContractReminderSent(user.id);
      console.log(`[ContractReminder] Sent for user ${user.id} (${contractType})`);
    }
  } catch (err) {
    console.error('[ContractReminder] Failed:', err.message);
  } finally {
    running = false;
  }
}

function startContractReminderScheduler() {
  if (intervalHandle) return;
  console.log('[ContractReminder] Scheduler started (checks every hour, 8 days ahead)');
  // Run shortly after boot, then hourly
  setTimeout(() => {
    processContractReminders();
  }, 15 * 1000);
  intervalHandle = setInterval(processContractReminders, CHECK_INTERVAL_MS);
}

function stopContractReminderScheduler() {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}

module.exports = {
  startContractReminderScheduler,
  stopContractReminderScheduler,
  processContractReminders,
  DAYS_AHEAD,
};
