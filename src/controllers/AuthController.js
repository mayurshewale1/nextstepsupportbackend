const User = require('../models/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const config = require('../config/env');
const { sendOtpWhatsApp, formatPhoneNumber } = require('../services/whatsappService');

const SALT_ROUNDS = 10;

// In-memory OTP store: { userId -> { otp, expiresAt, name, phone } }
const otpStore = new Map();

const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

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

exports.sendAdminOtp = async (req, res, next) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ success: false, message: 'userId is required' });
    }

    const user = await User.findByUserIdOrEmail(userId);
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    if (user.is_active === false) {
      return res.status(401).json({ success: false, message: 'Account is deactivated. Contact support.' });
    }
    if ((user.role || '').toLowerCase() !== 'admin') {
      return res.status(403).json({ success: false, message: 'OTP login is only for admin accounts' });
    }
    if (!user.phone) {
      return res.status(400).json({ success: false, message: 'No phone number on admin account. Contact support.' });
    }

    const otp = generateOtp();
    const expiresAt = Date.now() + OTP_TTL_MS;
    otpStore.set(String(user.id), { otp, expiresAt, name: user.name, phone: user.phone });

    const formattedPhone = formatPhoneNumber(user.phone);
    const result = await sendOtpWhatsApp(formattedPhone, user.name, otp);

    if (!result.success) {
      console.error('[OTP] WhatsApp send failed:', result.message);
      return res.status(500).json({ success: false, message: 'Failed to send OTP. Please try again.' });
    }

    console.log('[OTP] Sent to admin userId:', userId);
    return res.json({
      success: true,
      message: 'OTP sent to your registered WhatsApp number',
      phone: user.phone.replace(/(\d{2})\d+(\d{2})/, '$1****$2'),
    });
  } catch (error) {
    next(error);
  }
};

exports.verifyAdminOtp = async (req, res, next) => {
  try {
    const { userId, otp } = req.body;
    if (!userId || !otp) {
      return res.status(400).json({ success: false, message: 'userId and otp are required' });
    }

    const user = await User.findByUserIdOrEmail(userId);
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    if (user.is_active === false) {
      return res.status(401).json({ success: false, message: 'Account is deactivated. Contact support.' });
    }
    if ((user.role || '').toLowerCase() !== 'admin') {
      return res.status(403).json({ success: false, message: 'OTP login is only for admin accounts' });
    }

    const record = otpStore.get(String(user.id));
    if (!record) {
      return res.status(401).json({ success: false, message: 'No OTP requested. Please request a new OTP.' });
    }
    if (Date.now() > record.expiresAt) {
      otpStore.delete(String(user.id));
      return res.status(401).json({ success: false, message: 'OTP has expired. Please request a new one.' });
    }
    if (record.otp !== String(otp).trim()) {
      return res.status(401).json({ success: false, message: 'Invalid OTP. Please try again.' });
    }

    otpStore.delete(String(user.id));

    const token = jwt.sign(
      { id: user.id, role: user.role, email: user.email },
      config.jwtSecret,
      { expiresIn: config.jwtExpire }
    );

    return res.json({
      success: true,
      token,
      user: {
        id: user.id,
        userId: user.user_id,
        email: user.email,
        name: user.name,
        role: user.role,
        phone: user.phone,
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
