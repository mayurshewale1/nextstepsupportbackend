const axios = require('axios');
const qs = require('qs');

/**
 * WhatsApp Service using Bigtos API
 * Handles sending WhatsApp template messages for complaint acknowledgments
 */

// Bigtos API Configuration
const WHATSAPP_API_URL = 'https://www.cp.bigtos.com/api/v1/sendmessage';
const WHATSAPP_API_KEY = process.env.BIGTOS_API_KEY;

/**
 * Send WhatsApp acknowledgment message using Bigtos API
 * @param {string} phone - User phone number (format: 91XXXXXXXXXX)
 * @param {string} customerName - Customer's name
 * @param {string} serviceId - Service ID (format: NXP-SVC-XXXXXX)
 * @param {string} category - Complaint category
 * @returns {Promise<{success: boolean, message: string, data?: any}>}
 */
const sendWhatsApp = async (phone, customerName, serviceId, category, ticketDetails = {}) => {
  try {
    // Validate inputs
    if (!phone || !customerName || !serviceId) {
      throw new Error('Missing required parameters: phone, customerName, serviceId');
    }

    // Validate phone number format (should include country code)
    if (!phone.match(/^\d{10,15}$/)) {
      throw new Error('Invalid phone number format. Must include country code (91XXXXXXXXXX)');
    }

    // Check API key
    if (!WHATSAPP_API_KEY) {
      throw new Error('Bigtos API key not configured in environment variables');
    }

    // Extract ticket details with defaults
    const { title = '', priority = 'medium', description = '', assignedToName = null } = ticketDetails;
    const priorityLabel = priority.charAt(0).toUpperCase() + priority.slice(1);
    
    // Build detailed message
    let messageText = `Hello ${customerName},\n\n`;
    messageText += `Your complaint has been successfully registered.\n\n`;
    messageText += `*Ticket Details:*\n`;
    messageText += `Service ID: ${serviceId}\n`;
    messageText += `Category: ${category || 'General'}\n`;
    messageText += `Priority: ${priorityLabel}\n`;
    if (title) {
      messageText += `Title: ${title}\n`;
    }
    if (assignedToName) {
      messageText += `Assigned Engineer: ${assignedToName}\n`;
    }
    messageText += `\nWe will address your concern soon. Thank you for contacting NextStep Multiparking Support.`;

    // Prepare request payload
    const payload = {
      key: WHATSAPP_API_KEY,
      mobileno: phone,
      msg: messageText,
      type: "Text"
    };

    console.log('[WhatsApp Service] Sending detailed acknowledgment:', {
      to: phone,
      serviceId,
      customerName,
      category,
      priority,
      type: 'Text'
    });

    // Make API request
    const response = await axios.post(WHATSAPP_API_URL, qs.stringify(payload), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      timeout: 30000 // 30 seconds timeout
    });

    console.log('[WhatsApp Service] API Response:', {
      status: response.status,
      data: response.data
    });

    // Check response status
    if (response.data && response.data.status === 'success') {
      return {
        success: true,
        message: 'WhatsApp acknowledgment sent successfully',
        data: response.data
      };
    } else {
      throw new Error(response.data?.message || 'WhatsApp API returned error');
    }

  } catch (error) {
    console.error('[WhatsApp Service] Error sending WhatsApp message:', {
      error: error.message,
      stack: error.stack,
      phone: phone?.substring(0, 6) + '****', // Partial phone for logging
      serviceId
    });

    // Return error details
    return {
      success: false,
      message: error.response?.data?.message || error.message || 'Failed to send WhatsApp message',
      error: error.message
    };
  }
};

/**
 * Send WhatsApp status update message with detailed information
 * @param {string} phone - User phone number
 * @param {string} customerName - Customer's name
 * @param {string} serviceId - Service ID
 * @param {string} status - New status
 * @param {Object} updateDetails - Additional details about the update
 * @returns {Promise<{success: boolean, message: string, data?: any}>}
 */
const sendStatusUpdate = async (phone, customerName, serviceId, status, updateDetails = {}) => {
  try {
    if (!phone || !customerName || !serviceId || !status) {
      throw new Error('Missing required parameters: phone, customerName, serviceId, status');
    }

    if (!phone.match(/^\d{10,15}$/)) {
      throw new Error('Invalid phone number format. Must include country code (91XXXXXXXXXX)');
    }

    if (!WHATSAPP_API_KEY) {
      throw new Error('Bigtos API key not configured in environment variables');
    }

    const statusLabel = status.charAt(0).toUpperCase() + status.slice(1).replace(/-/g, ' ');
    const { category = '', priority = '', assignedToName = '', updatedBy = '', notes = '' } = updateDetails;
    
    // Build detailed status update message
    let messageText = `Hello ${customerName},\n\n`;
    messageText += `Your ticket *${serviceId}* has been updated.\n\n`;
    messageText += `*Updated Status:* ${statusLabel}\n`;
    if (category) {
      messageText += `Category: ${category}\n`;
    }
    if (priority) {
      messageText += `Priority: ${priority.charAt(0).toUpperCase() + priority.slice(1)}\n`;
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
    messageText += `\nThank you for your patience. For queries, contact NextStep Multiparking Support.`;

    const payload = {
      key: WHATSAPP_API_KEY,
      mobileno: phone,
      msg: messageText,
      type: "Text"
    };

    console.log('[WhatsApp Service] Sending detailed status update:', {
      to: phone,
      serviceId,
      customerName,
      status,
      statusLabel
    });

    const response = await axios.post(WHATSAPP_API_URL, qs.stringify(payload), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      timeout: 30000
    });

    console.log('[WhatsApp Service] Status update response:', {
      status: response.status,
      data: response.data
    });

    if (response.data && response.data.status === 'success') {
      return {
        success: true,
        message: 'WhatsApp status update sent successfully',
        data: response.data
      };
    } else {
      throw new Error(response.data?.message || 'WhatsApp API returned error');
    }

  } catch (error) {
    console.error('[WhatsApp Service] Error sending status update:', {
      error: error.message,
      phone: phone?.substring(0, 6) + '****',
      serviceId
    });
    return {
      success: false,
      message: error.message || 'Failed to send WhatsApp status update'
    };
  }
};

/**
 * Send OTP via WhatsApp
 * @param {string} phone - User phone number
 * @param {string} customerName - Customer's name
 * @param {string} otp - 6-digit OTP
 * @param {string} purpose - Purpose of OTP: 'login' | 'ticket-completion' (default: 'login')
 * @returns {Promise<{success: boolean, message: string, data?: any}>}
 */
const sendOtpWhatsApp = async (phone, customerName, otp, purpose = 'login') => {
  try {
    if (!phone || !customerName || !otp) {
      throw new Error('Missing required parameters: phone, customerName, otp');
    }

    if (!phone.match(/^\d{10,15}$/)) {
      throw new Error('Invalid phone number format. Must include country code (91XXXXXXXXXX)');
    }

    if (!WHATSAPP_API_KEY) {
      throw new Error('Bigtos API key not configured in environment variables');
    }

    // Build message based on purpose
    let messageText;
    if (purpose === 'ticket-completion') {
      messageText = `Hello ${customerName},\n\nYour OTP for *ticket completion verification* is: *${otp}*\n\nThis OTP is valid for 10 minutes. Please share this code with the engineer to confirm your ticket has been completed successfully.\n\nDo not share this OTP with anyone else for security reasons.`;
    } else {
      messageText = `Hello ${customerName}, your NextStep Admin login OTP is: *${otp}*. This OTP is valid for 10 minutes. Do not share it with anyone.`;
    }

    const payload = {
      key: WHATSAPP_API_KEY,
      mobileno: phone,
      msg: messageText,
      type: "Text"
    };

    console.log('[WhatsApp Service] Sending OTP:', {
      to: phone,
      customerName,
    });

    const response = await axios.post(WHATSAPP_API_URL, qs.stringify(payload), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      timeout: 30000
    });

    console.log('[WhatsApp Service] OTP response:', {
      status: response.status,
      data: response.data
    });

    if (response.data && response.data.status && response.data.status.toLowerCase() === 'success') {
      return {
        success: true,
        message: 'OTP sent successfully via WhatsApp',
        data: response.data
      };
    } else {
      throw new Error((response.data && response.data.message) || 'WhatsApp API returned error');
    }

  } catch (error) {
    console.error('[WhatsApp Service] Error sending OTP:', {
      error: error.message,
      phone: phone?.substring(0, 6) + '****',
    });
    return {
      success: false,
      message: error.message || 'Failed to send OTP'
    };
  }
};

/**
 * Send WhatsApp notification to engineer when ticket is assigned with full details
 * @param {string} phone - Engineer phone number
 * @param {string} engineerName - Engineer's name
 * @param {string} serviceId - Service ID
 * @param {string} customerName - Customer's name
 * @param {string} category - Ticket category
 * @param {Object} ticketDetails - Additional ticket details
 * @returns {Promise<{success: boolean, message: string, data?: any}>}
 */
const sendEngineerAssignmentNotification = async (phone, engineerName, serviceId, customerName, category, ticketDetails = {}) => {
  try {
    if (!phone || !engineerName || !serviceId) {
      throw new Error('Missing required parameters: phone, engineerName, serviceId');
    }

    if (!phone.match(/^\d{10,15}$/)) {
      throw new Error('Invalid phone number format. Must include country code (91XXXXXXXXXX)');
    }

    if (!WHATSAPP_API_KEY) {
      throw new Error('Bigtos API key not configured in environment variables');
    }

    // Extract detailed information
    const { 
      title = '', 
      priority = 'medium', 
      customerPhone = '', 
      customerEmail = '', 
      siteAddress = '', 
      description = '',
      latitude = null,
      longitude = null
    } = ticketDetails;
    
    const priorityLabel = priority.charAt(0).toUpperCase() + priority.slice(1);
    
    // Build detailed assignment message
    let messageText = `Hello ${engineerName},\n\n`;
    messageText += `A new ticket has been assigned to you.\n\n`;
    messageText += `*Ticket Details:*\n`;
    messageText += `Service ID: ${serviceId}\n`;
    if (title) {
      messageText += `Title: ${title}\n`;
    }
    messageText += `Category: ${category || 'General'}\n`;
    messageText += `Priority: ${priorityLabel}\n\n`;
    
    messageText += `*Customer Details:*\n`;
    messageText += `Name: ${customerName || 'N/A'}\n`;
    if (customerPhone) {
      messageText += `Phone: ${customerPhone}\n`;
    }
    if (customerEmail) {
      messageText += `Email: ${customerEmail}\n`;
    }
    if (siteAddress) {
      messageText += `Site Address: ${siteAddress}\n`;
    }
    if (latitude && longitude) {
      messageText += `Location: https://maps.google.com/?q=${latitude},${longitude}\n`;
    }
    
    if (description) {
      // Truncate description if too long
      const shortDesc = description.length > 100 ? description.substring(0, 100) + '...' : description;
      messageText += `\n*Issue Description:*\n${shortDesc}\n`;
    }
    
    messageText += `\nPlease check the app for complete details and take necessary action urgently.`;

    const payload = {
      key: WHATSAPP_API_KEY,
      mobileno: phone,
      msg: messageText,
      type: "Text"
    };

    console.log('[WhatsApp Service] Sending detailed engineer assignment notification:', {
      to: phone,
      serviceId,
      engineerName,
      customerName,
      priority: priorityLabel
    });

    const response = await axios.post(WHATSAPP_API_URL, qs.stringify(payload), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 30000
    });

    if (response.data && response.data.status === 'success') {
      return {
        success: true,
        message: 'Engineer assignment notification sent successfully',
        data: response.data
      };
    } else {
      throw new Error(response.data?.message || 'WhatsApp API returned error');
    }

  } catch (error) {
    console.error('[WhatsApp Service] Error sending engineer notification:', {
      error: error.message,
      phone: phone?.substring(0, 6) + '****',
      serviceId
    });
    return {
      success: false,
      message: error.message || 'Failed to send engineer notification'
    };
  }
};

/**
 * Send WhatsApp notification to admin about ticket updates with full details
 * @param {string} phone - Admin phone number
 * @param {string} adminName - Admin's name
 * @param {string} serviceId - Service ID
 * @param {string} status - Ticket status
 * @param {string} customerName - Customer's name
 * @param {Object} ticketDetails - Additional ticket details
 * @returns {Promise<{success: boolean, message: string, data?: any}>}
 */
const sendAdminTicketNotification = async (phone, adminName, serviceId, status, customerName, ticketDetails = {}) => {
  try {
    if (!phone || !serviceId || !status) {
      throw new Error('Missing required parameters: phone, serviceId, status');
    }

    if (!phone.match(/^\d{10,15}$/)) {
      throw new Error('Invalid phone number format. Must include country code (91XXXXXXXXXX)');
    }

    if (!WHATSAPP_API_KEY) {
      throw new Error('Bigtos API key not configured in environment variables');
    }

    const statusLabel = status.charAt(0).toUpperCase() + status.slice(1).replace(/-/g, ' ');
    const { 
      category = '', 
      priority = '', 
      assignedToName = '', 
      updatedBy = '', 
      actionType = 'updated',
      title = ''
    } = ticketDetails;
    
    // Build detailed admin notification
    let messageText = `Hello ${adminName || 'Admin'},\n\n`;
    messageText += `A ticket has been *${actionType}* in the system.\n\n`;
    messageText += `*Ticket Details:*\n`;
    messageText += `Service ID: ${serviceId}\n`;
    if (title) {
      messageText += `Title: ${title}\n`;
    }
    messageText += `Current Status: ${statusLabel}\n`;
    if (category) {
      messageText += `Category: ${category}\n`;
    }
    if (priority) {
      messageText += `Priority: ${priority.charAt(0).toUpperCase() + priority.slice(1)}\n`;
    }
    messageText += `\n*Customer:* ${customerName || 'N/A'}\n`;
    if (assignedToName) {
      messageText += `Assigned Engineer: ${assignedToName}\n`;
    }
    if (updatedBy) {
      messageText += `Action By: ${updatedBy}\n`;
    }
    messageText += `\nPlease check the admin dashboard for complete details.`;

    const payload = {
      key: WHATSAPP_API_KEY,
      mobileno: phone,
      msg: messageText,
      type: "Text"
    };

    console.log('[WhatsApp Service] Sending detailed admin notification:', {
      to: phone,
      serviceId,
      status,
      actionType,
      customerName
    });

    const response = await axios.post(WHATSAPP_API_URL, qs.stringify(payload), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 30000
    });

    if (response.data && response.data.status === 'success') {
      return {
        success: true,
        message: 'Admin notification sent successfully',
        data: response.data
      };
    } else {
      throw new Error(response.data?.message || 'WhatsApp API returned error');
    }

  } catch (error) {
    console.error('[WhatsApp Service] Error sending admin notification:', {
      error: error.message,
      phone: phone?.substring(0, 6) + '****',
      serviceId
    });
    return {
      success: false,
      message: error.message || 'Failed to send admin notification'
    };
  }
};

/**
 * Validate phone number and format for WhatsApp
 * @param {string} phone - Phone number to validate
 * @returns {string} - Formatted phone number
 */
const formatPhoneNumber = (phone) => {
  // Remove all non-digit characters
  let cleanPhone = phone.replace(/\D/g, '');
  
  // If starts with 0, remove it and add country code
  if (cleanPhone.startsWith('0') && cleanPhone.length === 10) {
    cleanPhone = '91' + cleanPhone.substring(1);
  }
  
  // If doesn't start with country code, add India code
  if (!cleanPhone.startsWith('91') && cleanPhone.length === 10) {
    cleanPhone = '91' + cleanPhone;
  }
  
  return cleanPhone;
};

module.exports = {
  sendWhatsApp,
  sendStatusUpdate,
  sendOtpWhatsApp,
  sendEngineerAssignmentNotification,
  sendAdminTicketNotification,
  formatPhoneNumber
};
