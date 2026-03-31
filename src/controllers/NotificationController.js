const NotificationToken = require('../models/NotificationToken');

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
}

module.exports = NotificationController;
