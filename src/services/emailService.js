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
const sendEmail = async (email, customerName, serviceId, category, ticketDetails = {}) => {
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

    // Extract ticket details
    const { title = '', assignedToName = '', description = '' } = ticketDetails;

    // Prepare email content
    const emailSubject = `Complaint Acknowledgment - ${serviceId}`;
    
    // Build detailed message
    let messageText = `Hello ${customerName},\n\n`;
    messageText += `Your complaint has been successfully registered with Nextstep Multiparking Support.\n\n`;
    messageText += `TICKET DETAILS:\n`;
    messageText += `Service ID: ${serviceId}\n`;
    if (title) {
      messageText += `Title: ${title}\n`;
    }
    messageText += `Category: ${category || 'General Inquiry'}\n`;
    messageText += `Status: Received\n`;
    if (assignedToName) {
      messageText += `Assigned Engineer: ${assignedToName}\n`;
    }
    if (description) {
      const shortDesc = description.length > 200 ? description.substring(0, 200) + '...' : description;
      messageText += `\nDescription: ${shortDesc}\n`;
    }
    messageText += `\nWe will address your concern as soon as possible. Thank you for contacting us.`;

    const emailText = `
${messageText}

---
This is an automated message. Please do not reply to this email.
© 2026 Nextstep Multiparking Support. All rights reserved.
    `;

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; max-width: 600px;">
        <h2 style="color: #667eea; margin: 0 0 20px 0; font-size: 18px;">Complaint Acknowledgment</h2>
        <p style="margin: 0 0 15px 0; font-size: 14px; line-height: 1.5;">Hello ${customerName},</p>
        <p style="margin: 0 0 15px 0; font-size: 14px; line-height: 1.5;">Your complaint has been successfully registered with <strong>Nextstep Multiparking Support</strong>.</p>
        
        <div style="margin: 20px 0; padding: 15px; background: #f8f9fa; border-left: 4px solid #667eea; border-radius: 4px;">
          <h3 style="margin: 0 0 12px 0; font-size: 14px; color: #333; text-transform: uppercase; letter-spacing: 0.5px;">Ticket Details</h3>
          <table style="width: 100%; font-size: 13px; line-height: 1.6;">
            <tr><td style="padding: 4px 0; color: #666; width: 140px;">Service ID:</td><td style="font-weight: 600; color: #333;">${serviceId}</td></tr>
            ${title ? `<tr><td style="padding: 4px 0; color: #666;">Title:</td><td style="color: #333;">${title}</td></tr>` : ''}
            <tr><td style="padding: 4px 0; color: #666;">Category:</td><td style="color: #333;">${category || 'General Inquiry'}</td></tr>
            <tr><td style="padding: 4px 0; color: #666;">Status:</td><td style="color: #333;"><span style="background: #dcfce7; color: #16a34a; padding: 2px 8px; border-radius: 3px; font-size: 11px; font-weight: 600;">Received</span></td></tr>
            ${assignedToName ? `<tr><td style="padding: 4px 0; color: #666;">Assigned Engineer:</td><td style="color: #333;">${assignedToName}</td></tr>` : ''}
          </table>
        </div>
        
        ${description ? `<div style="margin: 20px 0; padding: 15px; background: #f8f9fa; border-radius: 4px;"><h4 style="margin: 0 0 8px 0; font-size: 13px; color: #333;">Description</h4><p style="margin: 0; font-size: 13px; line-height: 1.6; color: #555;">${description.length > 300 ? description.substring(0, 300) + '...' : description}</p></div>` : ''}
        
        <p style="margin: 20px 0 5px 0; font-size: 13px; line-height: 1.5; color: #555;">We will address your concern as soon as possible. Thank you for contacting us.</p>
        
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
          <p style="margin: 0; font-size: 11px; color: #9ca3af;">This is an automated message. Please do not reply to this email.</p>
          <p style="margin: 5px 0 0 0; font-size: 11px; color: #9ca3af;">© 2026 Nextstep Multiparking Support. All rights reserved.</p>
        </div>
      </div>
    `;

    // Send email
    const mailOptions = {
      from: `"Nextstep Multiparking Support" <${FROM_EMAIL}>`,
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

/**
 * Send email status update notification using Nodemailer with detailed information
 * @param {string} email - User email address
 * @param {string} customerName - Customer's name
 * @param {string} serviceId - Service ID (format: NXP-SVC-XXXXXX)
 * @param {string} status - New ticket status
 * @param {Object} updateDetails - Additional update details
 * @returns {Promise<Object>} - Result object with success status and message
 */
const sendStatusUpdateEmail = async (email, customerName, serviceId, status, updateDetails = {}) => {
  try {
    if (!email || !customerName || !serviceId || !status) {
      throw new Error('Missing required parameters: email, customerName, serviceId, status');
    }

    if (!EMAIL_USER || !EMAIL_PASS) {
      throw new Error('Email credentials not configured in environment variables');
    }

    const transporter = nodemailer.createTransport({
      host: EMAIL_HOST,
      port: EMAIL_PORT,
      secure: EMAIL_PORT === 465,
      auth: {
        user: EMAIL_USER,
        pass: EMAIL_PASS,
      },
      tls: {
        rejectUnauthorized: false
      },
      connectionTimeout: 30000,
      greetingTimeout: 10000,
    });

    const statusLabel = status.charAt(0).toUpperCase() + status.slice(1).replace(/-/g, ' ');
    const { category = '', assignedToName = '', updatedBy = '', notes = '', title = '' } = updateDetails;
    
    // Status color mapping
    const statusColors = {
      'open': '#6b7280',
      'in-progress': '#d97706',
      'completed': '#0891b2',
      'resolved': '#16a34a',
      'closed': '#dc2626'
    };
    const statusBg = {
      'open': '#f3f4f6',
      'in-progress': '#fef3c7',
      'completed': '#cffafe',
      'resolved': '#dcfce7',
      'closed': '#fee2e2'
    };
    const statusColor = statusColors[status] || '#6b7280';
    const statusBgColor = statusBg[status] || '#f3f4f6';

    const emailSubject = `Ticket Status Update - ${serviceId}`;
    
    let messageText = `Hello ${customerName},\n\n`;
    messageText += `Your ticket has been updated.\n\n`;
    messageText += `TICKET DETAILS:\n`;
    messageText += `Service ID: ${serviceId}\n`;
    if (title) {
      messageText += `Title: ${title}\n`;
    }
    messageText += `Current Status: ${statusLabel}\n`;
    if (category) {
      messageText += `Category: ${category}\n`;
    }
    if (assignedToName) {
      messageText += `Assigned Engineer: ${assignedToName}\n`;
    }
    if (updatedBy) {
      messageText += `Updated By: ${updatedBy}\n`;
    }
    if (notes) {
      messageText += `\nNotes: ${notes}\n`;
    }
    messageText += `\nThank you for your patience.`;

    const emailText = `
${messageText}

---
This is an automated message. Please do not reply to this email.
© 2026 Nextstep Multiparking Support. All rights reserved.
    `;

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; max-width: 600px;">
        <h2 style="color: #667eea; margin: 0 0 20px 0; font-size: 18px;">Ticket Status Update</h2>
        <p style="margin: 0 0 15px 0; font-size: 14px; line-height: 1.5;">Hello ${customerName},</p>
        <p style="margin: 0 0 15px 0; font-size: 14px; line-height: 1.5;">Your ticket status has been updated. Here are the details:</p>
        
        <div style="margin: 20px 0; padding: 15px; background: #f8f9fa; border-left: 4px solid #667eea; border-radius: 4px;">
          <h3 style="margin: 0 0 12px 0; font-size: 14px; color: #333; text-transform: uppercase; letter-spacing: 0.5px;">Ticket Details</h3>
          <table style="width: 100%; font-size: 13px; line-height: 1.6;">
            <tr><td style="padding: 4px 0; color: #666; width: 140px;">Service ID:</td><td style="font-weight: 600; color: #333;">${serviceId}</td></tr>
            ${title ? `<tr><td style="padding: 4px 0; color: #666;">Title:</td><td style="color: #333;">${title}</td></tr>` : ''}
            <tr>
              <td style="padding: 4px 0; color: #666;">Current Status:</td>
              <td style="color: #333;">
                <span style="background: ${statusBgColor}; color: ${statusColor}; padding: 3px 10px; border-radius: 3px; font-size: 11px; font-weight: 600; text-transform: uppercase;">${statusLabel}</span>
              </td>
            </tr>
            ${category ? `<tr><td style="padding: 4px 0; color: #666;">Category:</td><td style="color: #333;">${category}</td></tr>` : ''}
            ${assignedToName ? `<tr><td style="padding: 4px 0; color: #666;">Assigned Engineer:</td><td style="color: #333;">${assignedToName}</td></tr>` : ''}
            ${updatedBy ? `<tr><td style="padding: 4px 0; color: #666;">Updated By:</td><td style="color: #333;">${updatedBy}</td></tr>` : ''}
          </table>
        </div>
        
        ${notes ? `<div style="margin: 20px 0; padding: 15px; background: #f0fdf4; border-radius: 4px; border-left: 4px solid #16a34a;"><h4 style="margin: 0 0 8px 0; font-size: 13px; color: #333;">Update Notes</h4><p style="margin: 0; font-size: 13px; line-height: 1.6; color: #555;">${notes}</p></div>` : ''}
        
        <p style="margin: 20px 0 5px 0; font-size: 13px; line-height: 1.5; color: #555;">Thank you for your patience. If you have any queries, please contact our support team.</p>
        
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
          <p style="margin: 0; font-size: 11px; color: #9ca3af;">This is an automated message. Please do not reply to this email.</p>
          <p style="margin: 5px 0 0 0; font-size: 11px; color: #9ca3af;">© 2026 Nextstep Multiparking Support. All rights reserved.</p>
        </div>
      </div>
    `;

    const mailOptions = {
      from: `"Nextstep Multiparking Support" <${FROM_EMAIL}>`,
      to: email,
      subject: emailSubject,
      text: emailText,
      html: emailHtml,
    };

    console.log('[Email Service] Sending status update email:', {
      to: email,
      serviceId,
      customerName,
      status,
      subject: emailSubject,
    });

    const result = await transporter.sendMail(mailOptions);

    console.log('[Email Service] Status update email sent successfully:', {
      messageId: result.messageId,
      to: email,
      serviceId,
    });

    return {
      success: true,
      message: 'Status update email sent successfully',
      data: {
        messageId: result.messageId,
        to: email,
        serviceId,
      },
    };

  } catch (error) {
    console.error('[Email Service] Error sending status update email:', {
      error: error.message,
      email: email?.substring(0, 6) + '****',
      serviceId,
    });

    return {
      success: false,
      message: error.message || 'Failed to send status update email',
      error: error.message,
    };
  }
};

/**
 * Send email notification to engineer when ticket is assigned with full details
 * @param {string} email - Engineer email address
 * @param {string} engineerName - Engineer's name
 * @param {string} serviceId - Service ID
 * @param {string} customerName - Customer's name
 * @param {string} category - Ticket category
 * @param {Object} ticketDetails - Additional ticket details
 * @returns {Promise<Object>} - Result object with success status and message
 */
const sendEngineerAssignmentEmail = async (email, engineerName, serviceId, customerName, category, ticketDetails = {}) => {
  try {
    if (!email || !engineerName || !serviceId) {
      throw new Error('Missing required parameters: email, engineerName, serviceId');
    }

    if (!EMAIL_USER || !EMAIL_PASS) {
      throw new Error('Email credentials not configured in environment variables');
    }

    const transporter = nodemailer.createTransport({
      host: EMAIL_HOST,
      port: EMAIL_PORT,
      secure: EMAIL_PORT === 465,
      auth: { user: EMAIL_USER, pass: EMAIL_PASS },
      tls: { rejectUnauthorized: false },
      connectionTimeout: 30000,
      greetingTimeout: 10000,
    });

    // Extract detailed information
    const {
      title = '',
      customerPhone = '',
      customerEmail = '',
      siteAddress = '',
      description = '',
      latitude = null,
      longitude = null
    } = ticketDetails;

    const emailSubject = `🆕 New Ticket Assigned - ${serviceId}`;
    
    let emailText = `Hello ${engineerName},\n\n`;
    emailText += `A new ticket has been assigned to you. Please review the details below and take necessary action urgently.\n\n`;
    emailText += `TICKET DETAILS:\n`;
    emailText += `Service ID: ${serviceId}\n`;
    if (title) {
      emailText += `Title: ${title}\n`;
    }
    emailText += `Category: ${category || 'General'}\n\n`;
    
    emailText += `CUSTOMER DETAILS:\n`;
    emailText += `Name: ${customerName || 'N/A'}\n`;
    if (customerPhone) {
      emailText += `Phone: ${customerPhone}\n`;
    }
    if (customerEmail) {
      emailText += `Email: ${customerEmail}\n`;
    }
    if (siteAddress) {
      emailText += `Site Address: ${siteAddress}\n`;
    }
    if (latitude && longitude) {
      emailText += `Location: https://maps.google.com/?q=${latitude},${longitude}\n`;
    }
    
    if (description) {
      emailText += `\nISSUE DESCRIPTION:\n${description}\n`;
    }
    
    emailText += `\nPlease check the mobile app for complete details and images (if any).\n`;
    emailText += `\n---\nThis is an automated message. Please do not reply to this email.\n© 2026 Nextstep Multiparking Support. All rights reserved.`;

    let locationSection = '';
    if (latitude && longitude) {
      locationSection = `
        <div style="margin: 15px 0;">
          <a href="https://maps.google.com/?q=${latitude},${longitude}" style="display: inline-block; background: #16a34a; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; font-size: 12px; font-weight: 600;">📍 View Location on Map</a>
        </div>`;
    }

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; max-width: 600px;">
        <div style="background: #667eea; color: white; padding: 15px 20px; margin: -20px -20px 20px -20px; border-radius: 4px 4px 0 0;">
          <h2 style="margin: 0; font-size: 18px;">🆕 New Ticket Assigned</h2>
        </div>
        
        <p style="margin: 0 0 15px 0; font-size: 14px; line-height: 1.5;">Hello ${engineerName},</p>
        <p style="margin: 0 0 15px 0; font-size: 14px; line-height: 1.5;">A new ticket has been assigned to you. Please review the details below and take necessary action urgently.</p>
        
        <div style="margin: 20px 0; padding: 15px; background: #f8f9fa; border-left: 4px solid #667eea; border-radius: 4px;">
          <h3 style="margin: 0 0 12px 0; font-size: 14px; color: #333; text-transform: uppercase; letter-spacing: 0.5px;">Ticket Details</h3>
          <table style="width: 100%; font-size: 13px; line-height: 1.6;">
            <tr><td style="padding: 4px 0; color: #666; width: 140px;">Service ID:</td><td style="font-weight: 600; color: #333;">${serviceId}</td></tr>
            ${title ? `<tr><td style="padding: 4px 0; color: #666;">Title:</td><td style="color: #333;">${title}</td></tr>` : ''}
            <tr><td style="padding: 4px 0; color: #666;">Category:</td><td style="color: #333;">${category || 'General'}</td></tr>
          </table>
        </div>
        
        <div style="margin: 20px 0; padding: 15px; background: #f8f9fa; border-left: 4px solid #0891b2; border-radius: 4px;">
          <h3 style="margin: 0 0 12px 0; font-size: 14px; color: #333; text-transform: uppercase; letter-spacing: 0.5px;">Customer Details</h3>
          <table style="width: 100%; font-size: 13px; line-height: 1.6;">
            <tr><td style="padding: 4px 0; color: #666; width: 140px;">Name:</td><td style="color: #333;">${customerName || 'N/A'}</td></tr>
            ${customerPhone ? `<tr><td style="padding: 4px 0; color: #666;">Phone:</td><td style="color: #333;"><a href="tel:${customerPhone}" style="color: #0891b2; text-decoration: none;">${customerPhone}</a></td></tr>` : ''}
            ${customerEmail ? `<tr><td style="padding: 4px 0; color: #666;">Email:</td><td style="color: #333;"><a href="mailto:${customerEmail}" style="color: #0891b2; text-decoration: none;">${customerEmail}</a></td></tr>` : ''}
            ${siteAddress ? `<tr><td style="padding: 4px 0; color: #666; vertical-align: top;">Site Address:</td><td style="color: #333;">${siteAddress}</td></tr>` : ''}
          </table>
          ${locationSection}
        </div>
        
        ${description ? `<div style="margin: 20px 0; padding: 15px; background: #fefce8; border-left: 4px solid #ca8a04; border-radius: 4px;"><h4 style="margin: 0 0 8px 0; font-size: 13px; color: #333;">Issue Description</h4><p style="margin: 0; font-size: 13px; line-height: 1.6; color: #555; white-space: pre-wrap;">${description}</p></div>` : ''}
        
        <div style="margin: 20px 0; padding: 15px; background: #f0f9ff; border-radius: 4px; border: 1px solid #bae6fd;">
          <p style="margin: 0; font-size: 13px; color: #0369a1; font-weight: 600;">📱 Please check the mobile app for complete details and images (if any).</p>
        </div>
        
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
          <p style="margin: 0; font-size: 11px; color: #9ca3af;">This is an automated message. Please do not reply to this email.</p>
          <p style="margin: 5px 0 0 0; font-size: 11px; color: #9ca3af;">© 2026 Nextstep Multiparking Support. All rights reserved.</p>
        </div>
      </div>
    `;

    const mailOptions = {
      from: `"Nextstep Multiparking Support" <${FROM_EMAIL}>`,
      to: email,
      subject: emailSubject,
      text: emailText,
      html: emailHtml,
    };

    console.log('[Email Service] Sending engineer assignment email:', { to: email, serviceId, engineerName });

    const result = await transporter.sendMail(mailOptions);

    console.log('[Email Service] Engineer assignment email sent successfully:', { messageId: result.messageId, to: email });

    return { success: true, message: 'Engineer assignment email sent successfully', data: { messageId: result.messageId, to: email, serviceId } };

  } catch (error) {
    console.error('[Email Service] Error sending engineer assignment email:', { error: error.message, email: email?.substring(0, 6) + '****', serviceId });
    return { success: false, message: error.message || 'Failed to send engineer assignment email', error: error.message };
  }
};

/**
 * Send email notification to admin about ticket updates with full details
 * @param {string} email - Admin email address
 * @param {string} adminName - Admin's name
 * @param {string} serviceId - Service ID
 * @param {string} status - Ticket status
 * @param {string} customerName - Customer's name
 * @param {Object} ticketDetails - Additional ticket details
 * @returns {Promise<Object>} - Result object with success status and message
 */
const sendAdminTicketEmail = async (email, adminName, serviceId, status, customerName, ticketDetails = {}) => {
  try {
    if (!email || !serviceId || !status) {
      throw new Error('Missing required parameters: email, serviceId, status');
    }

    if (!EMAIL_USER || !EMAIL_PASS) {
      throw new Error('Email credentials not configured in environment variables');
    }

    const transporter = nodemailer.createTransport({
      host: EMAIL_HOST,
      port: EMAIL_PORT,
      secure: EMAIL_PORT === 465,
      auth: { user: EMAIL_USER, pass: EMAIL_PASS },
      tls: { rejectUnauthorized: false },
      connectionTimeout: 30000,
      greetingTimeout: 10000,
    });

    const statusLabel = status.charAt(0).toUpperCase() + status.slice(1).replace(/-/g, ' ');
    const {
      category = '',
      assignedToName = '',
      updatedBy = '',
      actionType = 'updated',
      title = '',
      customerPhone = '',
      customerEmail = ''
    } = ticketDetails;
    
    // Status color mapping
    const statusColors = {
      'open': '#6b7280',
      'in-progress': '#d97706',
      'completed': '#0891b2',
      'resolved': '#16a34a',
      'closed': '#dc2626'
    };
    const statusBg = {
      'open': '#f3f4f6',
      'in-progress': '#fef3c7',
      'completed': '#cffafe',
      'resolved': '#dcfce7',
      'closed': '#fee2e2'
    };
    const statusColor = statusColors[status] || '#6b7280';
    const statusBgColor = statusBg[status] || '#f3f4f6';

    const actionLabel = actionType === 'created' ? 'New Ticket Created' : actionType === 'assigned' ? 'Ticket Assigned' : 'Ticket Updated';
    const emailSubject = `${actionLabel} - ${serviceId}`;

    let emailText = `Hello ${adminName || 'Admin'},\n\n`;
    emailText += `A ticket has been ${actionType} in the system.\n\n`;
    emailText += `TICKET DETAILS:\n`;
    emailText += `Service ID: ${serviceId}\n`;
    if (title) {
      emailText += `Title: ${title}\n`;
    }
    emailText += `Current Status: ${statusLabel}\n`;
    if (category) {
      emailText += `Category: ${category}\n`;
    }
    emailText += `\nCUSTOMER DETAILS:\n`;
    emailText += `Name: ${customerName || 'N/A'}\n`;
    if (customerPhone) {
      emailText += `Phone: ${customerPhone}\n`;
    }
    if (customerEmail) {
      emailText += `Email: ${customerEmail}\n`;
    }
    if (assignedToName) {
      emailText += `\nAssigned Engineer: ${assignedToName}\n`;
    }
    if (updatedBy) {
      emailText += `Action By: ${updatedBy}\n`;
    }
    emailText += `\nPlease check the admin dashboard for complete details.\n`;
    emailText += `\n---\nThis is an automated message. Please do not reply to this email.\n© 2026 Nextstep Multiparking Support. All rights reserved.`;

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; max-width: 600px;">
        <div style="background: ${statusColor}; color: white; padding: 15px 20px; margin: -20px -20px 20px -20px; border-radius: 4px 4px 0 0;">
          <h2 style="margin: 0; font-size: 18px;">${actionLabel}</h2>
        </div>
        
        <p style="margin: 0 0 15px 0; font-size: 14px; line-height: 1.5;">Hello ${adminName || 'Admin'},</p>
        <p style="margin: 0 0 15px 0; font-size: 14px; line-height: 1.5;">A ticket has been <strong>${actionType}</strong> in the system.</p>
        
        <div style="margin: 20px 0; padding: 15px; background: #f8f9fa; border-left: 4px solid ${statusColor}; border-radius: 4px;">
          <h3 style="margin: 0 0 12px 0; font-size: 14px; color: #333; text-transform: uppercase; letter-spacing: 0.5px;">Ticket Details</h3>
          <table style="width: 100%; font-size: 13px; line-height: 1.6;">
            <tr><td style="padding: 4px 0; color: #666; width: 140px;">Service ID:</td><td style="font-weight: 600; color: #333;">${serviceId}</td></tr>
            ${title ? `<tr><td style="padding: 4px 0; color: #666;">Title:</td><td style="color: #333;">${title}</td></tr>` : ''}
            <tr>
              <td style="padding: 4px 0; color: #666;">Current Status:</td>
              <td>
                <span style="background: ${statusBgColor}; color: ${statusColor}; padding: 3px 10px; border-radius: 3px; font-size: 11px; font-weight: 600; text-transform: uppercase;">${statusLabel}</span>
              </td>
            </tr>
            ${category ? `<tr><td style="padding: 4px 0; color: #666;">Category:</td><td style="color: #333;">${category}</td></tr>` : ''}
          </table>
        </div>
        
        <div style="margin: 20px 0; padding: 15px; background: #f8f9fa; border-left: 4px solid #0891b2; border-radius: 4px;">
          <h3 style="margin: 0 0 12px 0; font-size: 14px; color: #333; text-transform: uppercase; letter-spacing: 0.5px;">Customer Details</h3>
          <table style="width: 100%; font-size: 13px; line-height: 1.6;">
            <tr><td style="padding: 4px 0; color: #666; width: 140px;">Name:</td><td style="color: #333;">${customerName || 'N/A'}</td></tr>
            ${customerPhone ? `<tr><td style="padding: 4px 0; color: #666;">Phone:</td><td style="color: #333;">${customerPhone}</td></tr>` : ''}
            ${customerEmail ? `<tr><td style="padding: 4px 0; color: #666;">Email:</td><td style="color: #333;">${customerEmail}</td></tr>` : ''}
            ${assignedToName ? `<tr><td style="padding: 4px 0; color: #666;">Assigned Engineer:</td><td style="color: #333;">${assignedToName}</td></tr>` : ''}
            ${updatedBy ? `<tr><td style="padding: 4px 0; color: #666;">Action By:</td><td style="color: #333;">${updatedBy}</td></tr>` : ''}
          </table>
        </div>
        
        <div style="margin: 20px 0; padding: 15px; background: #f0f9ff; border-radius: 4px; border: 1px solid #bae6fd;">
          <p style="margin: 0; font-size: 13px; color: #0369a1; font-weight: 600;">📊 Please check the admin dashboard for complete details.</p>
        </div>
        
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
          <p style="margin: 0; font-size: 11px; color: #9ca3af;">This is an automated message. Please do not reply to this email.</p>
          <p style="margin: 5px 0 0 0; font-size: 11px; color: #9ca3af;">© 2026 Nextstep Multiparking Support. All rights reserved.</p>
        </div>
      </div>
    `;

    const mailOptions = {
      from: `"Nextstep Multiparking Support" <${FROM_EMAIL}>`,
      to: email,
      subject: emailSubject,
      text: emailText,
      html: emailHtml,
    };

    console.log('[Email Service] Sending admin notification email:', { to: email, serviceId, status });

    const result = await transporter.sendMail(mailOptions);

    console.log('[Email Service] Admin notification email sent successfully:', { messageId: result.messageId, to: email });

    return { success: true, message: 'Admin notification email sent successfully', data: { messageId: result.messageId, to: email, serviceId } };

  } catch (error) {
    console.error('[Email Service] Error sending admin notification email:', { error: error.message, email: email?.substring(0, 6) + '****', serviceId });
    return { success: false, message: error.message || 'Failed to send admin notification email', error: error.message };
  }
};

module.exports = {
  sendEmail,
  sendStatusUpdateEmail,
  sendEngineerAssignmentEmail,
  sendAdminTicketEmail,
};
