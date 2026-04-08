const axios = require('axios');
const qs = require('qs');

// Test simple text message first
const testSimpleMessage = async () => {
  const payload = {
    key: 'ZGZ5FKJEMVSUJATAKYDEMNMWF',
    mobileno: '91997543210', // Replace with test number
    msg: 'Hello Mayur Shewale, your ticket NXP-SVC-000062 for lock_issue has been received. We will address it soon.',
    type: 'Text'
  };

  try {
    const response = await axios.post('https://www.cp.bigtos.com/api/v1/sendmessage', qs.stringify(payload), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    console.log('Simple message response:', response.data);
  } catch (error) {
    console.error('Simple message error:', error.response?.data || error.message);
  }
};

// Test template message
const testTemplateMessage = async () => {
  const templateData = {
    name: "complaint_ack_template",
    language: { code: "en" },
    components: [
      {
        type: "body",
        parameters: [
          { type: "text", text: "Mayur Shewale" },
          { type: "text", text: "NXP-SVC-000062" },
          { type: "text", text: "lock_issue" }
        ]
      }
    ]
  };

  const payload = {
    key: 'ZGZ5FKJEMVSUJATAKYDEMNMWF',
    mobileno: '91997543210', // Replace with test number
    msg: JSON.stringify(templateData),
    type: "Template"
  };

  try {
    const response = await axios.post('https://www.cp.bigtos.com/api/v1/sendmessage', qs.stringify(payload), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    console.log('Template message response:', response.data);
  } catch (error) {
    console.error('Template message error:', error.response?.data || error.message);
  }
};

// Run tests
testSimpleMessage().then(() => {
  console.log('\n--- Testing Template Message ---\n');
  testTemplateMessage();
});
