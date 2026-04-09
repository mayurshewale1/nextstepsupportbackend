const nodemailer = require('nodemailer');

/**
 * Email Service using Nodemailer
 * Handles sending email acknowledgments for complaint acknowledgments
 */

// Email Configuration
const EMAIL_HOST = process.env.EMAIL_HOST || 'smtp.hostinger.com';
const EMAIL_PORT = process.env.EMAIL_PORT || 465;
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;
const FROM_EMAIL = process.env.FROM_EMAIL || EMAIL_USER;

/**
 * Send email acknowledgment message using Nodemailer
 * @param {string} email - User email address
 * @param {string} customerName - Customer's name
 * @param {string} serviceId - Service ID (format: NXP-SVC-XXXXXX)
 * @param {string} category - Ticket category (optional)
 * @returns {Promise<Object>} - Result object with success status and message
 */
const sendEmail = async (email, customerName, serviceId, category) => {
  try {
    // Validate inputs
    if (!email || !customerName || !serviceId) {
      throw new Error('Missing required parameters: email, customerName, serviceId');
    }

    // Check email configuration
    if (!EMAIL_USER || !EMAIL_PASS) {
      throw new Error('Email credentials not configured in environment variables');
    }

    // Create transporter
    const transporter = nodemailer.createTransport({
      host: EMAIL_HOST,
      port: EMAIL_PORT,
      secure: EMAIL_PORT === 465, // true for 465 (SSL), false for other ports
      auth: {
        user: EMAIL_USER,
        pass: EMAIL_PASS,
      },
      tls: {
        rejectUnauthorized: false
      },
      connectionTimeout: 30000, // 30 seconds timeout
      greetingTimeout: 10000, // 10 seconds timeout
    });

    // Prepare email content
    const emailSubject = `Complaint Acknowledgment - ${serviceId}`;
    
    // Simple message like WhatsApp
    const messageText = `Hello ${customerName}, your ticket ${serviceId} for ${category || 'general inquiry'} has been received. We will address it soon. Thank you for contacting Ultratech IT Support.`;

    const emailText = `
${messageText}

Service ID: ${serviceId}
Category: ${category || 'General Inquiry'}
Status: Received

This is an automated message. Please do not reply to this email.
© 2026 Ultratech IT Support. All rights reserved.
    `;

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
        <p style="margin: 0 0 15px 0; font-size: 14px; line-height: 1.5;">${messageText}</p>
        <div style="margin: 15px 0; padding: 10px; background: #f5f5f5; border-left: 3px solid #667eea;">
          <p style="margin: 5px 0; font-size: 12px;"><strong>Service ID:</strong> ${serviceId}</p>
          <p style="margin: 5px 0; font-size: 12px;"><strong>Category:</strong> ${category || 'General Inquiry'}</p>
          <p style="margin: 5px 0; font-size: 12px;"><strong>Status:</strong> Received</p>
        </div>
        <p style="margin: 15px 0 5px 0; font-size: 11px; color: #666;">This is an automated message. Please do not reply to this email.</p>
        <p style="margin: 5px 0; font-size: 11px; color: #666;">© 2026 Ultratech IT Support. All rights reserved.</p>
      </div>
    `;

    // Send email
    const mailOptions = {
      from: `"Ultratech IT Support" <${FROM_EMAIL}>`,
      to: email,
      subject: emailSubject,
      text: emailText,
      html: emailHtml,
    };

    console.log('[Email Service] Sending acknowledgment email:', {
      to: email,
      serviceId,
      customerName,
      category,
      subject: emailSubject,
    });

    const result = await transporter.sendMail(mailOptions);

    console.log('[Email Service] Email sent successfully:', {
      messageId: result.messageId,
      to: email,
      serviceId,
    });

    return {
      success: true,
      message: 'Email acknowledgment sent successfully',
      data: {
        messageId: result.messageId,
        to: email,
        serviceId,
      },
    };

  } catch (error) {
    console.error('[Email Service] Error sending email:', {
      error: error.message,
      stack: error.stack,
      email: email?.substring(0, 6) + '****', // Partial email for logging
      serviceId,
    });

    // Return error details
    return {
      success: false,
      message: error.response?.data?.message || error.message || 'Failed to send email acknowledgment',
      error: error.message,
    };
  }
};

module.exports = {
  sendEmail,
};
