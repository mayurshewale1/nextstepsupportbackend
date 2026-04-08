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
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px; text-align: center;">
          <h1 style="margin: 0; font-size: 28px;">NextStep Support</h1>
          <p style="margin: 10px 0; font-size: 16px; opacity: 0.9;">Complaint Acknowledgment</p>
        </div>
        
        <div style="background: #f8f9fa; padding: 30px; border-radius: 10px; margin: 20px 0;">
          <h2 style="color: #333; margin-bottom: 20px;">Hello ${customerName},</h2>
          
          <p style="color: #666; line-height: 1.6; margin-bottom: 20px;">
            Thank you for contacting NextStep Support. We have successfully received your complaint and our team is working on it.
          </p>
          
          <div style="background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #667eea;">
            <h3 style="color: #333; margin-top: 0;">Complaint Details:</h3>
            <p style="margin: 10px 0;"><strong>Service ID:</strong> ${serviceId}</p>
            <p style="margin: 10px 0;"><strong>Category:</strong> ${category || 'General Inquiry'}</p>
            <p style="margin: 10px 0;"><strong>Status:</strong> <span style="color: #28a745;">Received and Under Review</span></p>
          </div>
          
          <p style="color: #666; line-height: 1.6; margin: 20px 0;">
            Our support team will review your complaint and get back to you shortly. You can track the status of your complaint using the Service ID mentioned above.
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="https://nextstep.mayurr.in" style="background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
              Track Your Complaint
            </a>
          </div>
        </div>
        
        <div style="text-align: center; color: #999; font-size: 12px; margin-top: 30px;">
          <p>This is an automated message. Please do not reply to this email.</p>
          <p>&copy; 2026 NextStep Support. All rights reserved.</p>
        </div>
      </div>
    `;

    const emailText = `
      NextStep Support - Complaint Acknowledgment
      
      Hello ${customerName},
      
      Thank you for contacting NextStep Support. We have successfully received your complaint and our team is working on it.
      
      Complaint Details:
      Service ID: ${serviceId}
      Category: ${category || 'General Inquiry'}
      Status: Received and Under Review
      
      Our support team will review your complaint and get back to you shortly. You can track the status of your complaint using the Service ID mentioned above.
      
      Visit https://nextstep.mayurr.in to track your complaint.
      
      This is an automated message. Please do not reply to this email.
      © 2026 NextStep Support. All rights reserved.
    `;

    // Send email
    const mailOptions = {
      from: `"NextStep Support" <${FROM_EMAIL}>`,
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
