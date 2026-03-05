const bcrypt = require('bcryptjs');
const User = require('../models/User');
const sanitizeUser = User.sanitizeUser;

const SALT_ROUNDS = 10;

class UserController {
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
      const { email, password, name, role, phone, userId } = req.body;

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
}

module.exports = UserController;
