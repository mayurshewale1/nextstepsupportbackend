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
const sendWhatsApp = async (phone, customerName, serviceId, category) => {
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

    // Prepare template message
    const templateData = {
      name: "complaint_ack_template",
      language: { code: "en" },
      components: [
        {
          type: "body",
          parameters: [
            { type: "text", text: customerName },
            { type: "text", text: serviceId },
            { type: "text", text: category || "general inquiry" }
          ]
        }
      ]
    };

    // Prepare request payload
    const payload = {
      key: WHATSAPP_API_KEY,
      mobileno: phone,
      msg: JSON.stringify(templateData),
      type: "Template"
    };

    console.log('[WhatsApp Service] Sending message:', {
      to: phone,
      serviceId,
      customerName,
      category,
      template: 'complaint_ack_template'
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
 * Send WhatsApp status update message
 * @param {string} phone - User phone number
 * @param {string} customerName - Customer's name
 * @param {string} serviceId - Service ID
 * @param {string} status - New status
 * @returns {Promise<{success: boolean, message: string, data?: any}>}
 */
const sendStatusUpdate = async (phone, customerName, serviceId, status) => {
  try {
    const templateData = {
      name: "status_update_template", // This template should be created in Bigtos
      language: { code: "en" },
      components: [
        {
          type: "body",
          parameters: [
            { type: "text", text: customerName },
            { type: "text", text: serviceId },
            { type: "text", text: status }
          ]
        }
      ]
    };

    const payload = {
      key: WHATSAPP_API_KEY,
      mobileno: phone,
      msg: JSON.stringify(templateData),
      type: "Template"
    };

    const response = await axios.post(WHATSAPP_API_URL, qs.stringify(payload), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      timeout: 30000
    });

    return {
      success: true,
      message: 'WhatsApp status update sent successfully',
      data: response.data
    };

  } catch (error) {
    console.error('[WhatsApp Service] Error sending status update:', error.message);
    return {
      success: false,
      message: error.message || 'Failed to send WhatsApp status update'
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
  formatPhoneNumber
};
