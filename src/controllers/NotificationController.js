const NotificationToken = require('../models/NotificationToken');
const { sendTestNotification, sendToUsers } = require('../services/fcmService');

class NotificationController {
  static async registerDeviceToken(req, res, next) {
    try {
      const authUserId = Number(req.user?.id);
      const { userId, token, platform } = req.body || {};
      const targetUserId = Number(userId);

      if (!targetUserId || !token) {
        return res.status(400).json({
          success: false,
          message: 'userId and token are required',
        });
      }

      if (authUserId !== targetUserId) {
        return res.status(403).json({
          success: false,
          message: 'You can only register your own device token',
        });
      }

      const row = await NotificationToken.register({
        userId: targetUserId,
        token: String(token),
        platform: platform ? String(platform) : null,
      });

      return res.status(200).json({
        success: true,
        message: 'Device token registered',
        data: row,
      });
    } catch (error) {
      return next(error);
    }
  }

  static async unregisterDeviceToken(req, res, next) {
    try {
      const authUserId = Number(req.user?.id);
      const { userId, token } = req.body || {};
      const targetUserId = Number(userId);

      if (!targetUserId || !token) {
        return res.status(400).json({
          success: false,
          message: 'userId and token are required',
        });
      }

      if (authUserId !== targetUserId) {
        return res.status(403).json({
          success: false,
          message: 'You can only unregister your own device token',
        });
      }

      await NotificationToken.unregister({
        userId: targetUserId,
        token: String(token),
      });

      return res.status(200).json({
        success: true,
        message: 'Device token removed',
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Get all FCM tokens for the authenticated user
   */
  static async getMyTokens(req, res, next) {
    try {
      const userId = Number(req.user?.id);
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
      }

      const tokens = await NotificationToken.getUserTokens(userId);

      return res.status(200).json({
        success: true,
        data: tokens,
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Send test notification to current user
   */
  static async sendTest(req, res, next) {
    try {
      const userId = Number(req.user?.id);
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
      }

      // Get user's tokens
      const tokens = await NotificationToken.getTokensByUserIds([userId]);
      
      if (tokens.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No FCM tokens registered for this user',
        });
      }

      // Send test to first token
      const result = await sendTestNotification(tokens[0]);

      return res.status(200).json({
        success: result.success,
        message: result.success ? 'Test notification sent' : 'Failed to send test notification',
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  }
}

module.exports = NotificationController;
