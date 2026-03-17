const User = require('../models/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const config = require('../config/env');

const SALT_ROUNDS = 10;

exports.login = async (req, res, next) => {
  try {
    const { userId, password } = req.body;
    const user = await User.findByUserIdOrEmail(userId);
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    if (user.is_active === false) {
      return res.status(401).json({ success: false, message: 'Account is deactivated. Contact support.' });
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    const token = jwt.sign(
      { id: user.id, role: user.role, email: user.email },
      config.jwtSecret,
      { expiresIn: config.jwtExpire }
    );
    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        userId: user.user_id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Current password and new password are required' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'New password must be at least 6 characters' });
    }
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect' });
    }
    const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await User.updatePassword(userId, hashedPassword);
    res.status(200).json({
      success: true,
      message: 'Password changed successfully',
    });
  } catch (error) {
    next(error);
  }
};
