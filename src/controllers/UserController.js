const bcrypt = require('bcryptjs');
const User = require('../models/User');
const sanitizeUser = User.sanitizeUser;

const SALT_ROUNDS = 10;

class UserController {
  /**
   * Get current authenticated user's profile (fixes engineer profile display)
   */
  static async getCurrentUser(req, res, next) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
      }
      const user = await User.findById(parseInt(userId, 10));
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
        });
      }
      res.status(200).json({
        success: true,
        data: sanitizeUser(user),
      });
    } catch (error) {
      next(error);
    }
  }

  static async getAllUsers(req, res, next) {
    try {
      const { role } = req.query;
      const users = await User.getAll({ role: role || undefined });
      res.status(200).json({
        success: true,
        data: users,
        count: users.length,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getUserById(req, res, next) {
    try {
      const { id } = req.params;
      const user = await User.findById(parseInt(id, 10));
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
        });
      }
      res.status(200).json({
        success: true,
        data: sanitizeUser(user),
      });
    } catch (error) {
      next(error);
    }
  }

  static async createUser(req, res, next) {
    try {
      const { email, password, name, role, phone, userId, latitude, longitude, siteName, siteAddress, siteType, systemType, carCount, systemQuantity, state, area, areaHeadId } = req.body;

      const existingByEmail = await User.findByEmail(email);
      if (existingByEmail) {
        return res.status(400).json({
          success: false,
          message: 'Email already in use',
        });
      }
      const uid = userId || email.split('@')[0].replace(/[^a-z0-9]/gi, '_');
      const existingByUserId = await User.findByUserId(uid);
      if (existingByUserId) {
        return res.status(400).json({
          success: false,
          message: 'User ID already in use',
        });
      }

      const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
      const newUser = await User.create({
        userId: uid,
        email,
        password: hashedPassword,
        name: name || email.split('@')[0],
        role: role || 'user',
        phone: phone || null,
        latitude: latitude ?? null,
        longitude: longitude ?? null,
        siteName: siteName || null,
        siteAddress: siteAddress || null,
        siteType: siteType || null,
        systemType: systemType || null,
        carCount: carCount ?? null,
        systemQuantity: systemQuantity ?? null,
        state: state || null,
        area: area || null,
        areaHeadId: areaHeadId ?? null,
      });

      res.status(201).json({
        success: true,
        message: 'User created successfully',
        data: sanitizeUser(newUser),
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get all area heads for dropdown selection
   */
  static async getAreaHeads(req, res, next) {
    try {
      const areaHeads = await User.findAreaHeads();
      res.status(200).json({
        success: true,
        data: areaHeads,
        count: areaHeads.length,
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateUser(req, res, next) {
    try {
      const { id } = req.params;
      const updates = { ...req.body };
      delete updates.password;

      if (updates.email) {
        const existing = await User.findByEmail(updates.email);
        if (existing && existing.id !== parseInt(id, 10)) {
          return res.status(400).json({
            success: false,
            message: 'Email already in use',
          });
        }
      }

      const user = await User.update(parseInt(id, 10), updates);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
        });
      }

      res.status(200).json({
        success: true,
        message: 'User updated successfully',
        data: sanitizeUser(user),
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Engineer updates their own location (for nearest-engineer assignment)
   */
  static async updateMyLocation(req, res, next) {
    try {
      const { latitude, longitude } = req.body;
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
      }
      const user = await User.update(parseInt(userId, 10), { latitude, longitude });
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
        });
      }
      res.status(200).json({
        success: true,
        message: 'Location updated successfully',
        data: sanitizeUser(user),
      });
    } catch (error) {
      next(error);
    }
  }

  static async deleteUser(req, res, next) {
    try {
      const { id } = req.params;
      const success = await User.delete(parseInt(id, 10));
      if (!success) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
        });
      }
      res.status(200).json({
        success: true,
        message: 'User deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Admin or Engineer resets user password
   */
  static async resetUserPassword(req, res, next) {
    try {
      const { id } = req.params;
      const { newPassword } = req.body;

      // Validate access (Admin, Engineer, or User resetting own password) - case insensitive
      const userRole = req.user ? req.user.role.toLowerCase() : '';
      const isOwnPassword = req.user && parseInt(req.user.id) === parseInt(id);
      
      if (!req.user || (userRole !== 'admin' && userRole !== 'engineer' && !isOwnPassword)) {
        return res.status(403).json({
          success: false,
          message: 'Admin, Engineer, or own password reset required',
        });
      }

      // Validate new password
      if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({
          success: false,
          message: 'Password must be at least 6 characters long',
        });
      }

      // Check if user exists
      const user = await User.findById(parseInt(id, 10));
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
        });
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);

      // Update password using the dedicated updatePassword method
      const updatedUser = await User.updatePassword(parseInt(id, 10), hashedPassword);
      
      if (!updatedUser) {
        return res.status(500).json({
          success: false,
          message: 'Failed to reset password',
        });
      }

      res.status(200).json({
        success: true,
        message: 'Password reset successfully',
        data: {
          userId: user.userId,
          role: user.role,
          resetAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Admin bulk reset passwords for multiple users
   */
  static async bulkResetPasswords(req, res, next) {
    try {
      const { userIds, newPassword } = req.body;

      // Validate admin access
      if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Admin access required',
        });
      }

      // Validate inputs
      if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'User IDs array is required',
        });
      }

      if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({
          success: false,
          message: 'Password must be at least 6 characters long',
        });
      }

      // Hash new password once
      const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);

      const results = [];
      const errors = [];

      // Process each user
      for (const userId of userIds) {
        try {
          const user = await User.findById(parseInt(userId, 10));
          if (!user) {
            errors.push({ userId, error: 'User not found' });
            continue;
          }

          const updatedUser = await User.update(parseInt(userId, 10), { password: hashedPassword });
          if (updatedUser) {
            results.push({
              userId: user.userId,
              role: user.role,
              resetAt: new Date().toISOString(),
            });
          } else {
            errors.push({ userId, error: 'Failed to reset password' });
          }
        } catch (error) {
          errors.push({ userId, error: error.message });
        }
      }

      res.status(200).json({
        success: true,
        message: `Password reset completed for ${results.length} users`,
        data: {
          reset: results,
          errors: errors,
          total: userIds.length,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = UserController;
