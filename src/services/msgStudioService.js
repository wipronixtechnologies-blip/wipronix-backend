const rawAxios = require('axios');
const axios = rawAxios.default || rawAxios;

const MSGSTUDIO_BASE_URL = process.env.MSGSTUDIO_BASE_URL;
const MSGSTUDIO_API_KEY = process.env.MSGSTUDIO_API_KEY;
const MSGSTUDIO_WABA_ID = process.env.MSGSTUDIO_WABA_ID;
const MSGSTUDIO_RCS_REGISTER_ID = process.env.MSGSTUDIO_RCS_REGISTER_ID || process.env.MSGSTUDIO_WABA_ID;
const MSGSTUDIO_TEMPLATE_NAME = process.env.MSGSTUDIO_TEMPLATE_NAME;
const MSGSTUDIO_TEMPLATE_ID = process.env.MSGSTUDIO_TEMPLATE_ID;

function sanitizePublicReceiptUrl(urlOrText) {
  if (typeof urlOrText !== 'string') return urlOrText;
  const frontendBase = (process.env.FRONTEND_URL || process.env.CLIENT_URL || 'https://www.wipronix.com').replace(/\/+$/, '');
  return urlOrText.replace(/(?:https?:\/\/localhost:\d+|https?:\/\/[^\/\s]+)\/api\/public\/receipt\/([A-Za-z0-9\-]+)/g, `${frontendBase}/receipt/$1`);
}


/**
 * Send WhatsApp / RCS Template message via MsgStudio API
 */
async function sendWhatsAppTemplate({ mobile, templateName, templateId, wapId, variables = [], mediaUrl }) {
  try {
    const apiKey = process.env.MSGSTUDIO_API_KEY || MSGSTUDIO_API_KEY;
    if (!apiKey) {
      console.warn('[MsgStudio] No API key configured.');
      return { success: false, message: 'MsgStudio API key not configured' };
    }

    // Clean mobile number (format: 91XXXXXXXXXX)
    const cleanDigits = (mobile || '').toString().replace(/\D/g, '');
    const formattedMobile = cleanDigits.length === 10 ? `91${cleanDigits}` : cleanDigits;

    if (!formattedMobile || formattedMobile.length < 10) {
      return { success: false, message: 'Invalid mobile number' };
    }

    const targetTemplateName = templateName || process.env.MSGSTUDIO_TEMPLATE_NAME || MSGSTUDIO_TEMPLATE_NAME;
    const targetWapId = wapId || process.env.MSGSTUDIO_WABA_ID || MSGSTUDIO_WABA_ID;
    const targetRcsRegisterId = process.env.MSGSTUDIO_RCS_REGISTER_ID || targetWapId;

    const payload = {
      mobile: formattedMobile,
      name: targetTemplateName,
      templateId: templateId || process.env.MSGSTUDIO_TEMPLATE_ID || MSGSTUDIO_TEMPLATE_ID,
      rcsRegisterId: targetRcsRegisterId,
      wapId: targetWapId,
      variables: Array.isArray(variables) ? variables.map(v => sanitizePublicReceiptUrl(v)) : [],
      ...(mediaUrl ? { mediaUrl } : {})
    };

    console.log('[MsgStudio] Dispatching WhatsApp template message:', {
      mobile: payload.mobile,
      name: payload.name,
      wapId: payload.wapId,
      variablesCount: payload.variables.length
    });

    const response = await axios.post(`${MSGSTUDIO_BASE_URL}/send/template/msg`, payload, {
      headers: {
        key: apiKey,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    if (response.data && (response.data.statusCode === 200 || response.data.message === 'Success' || response.data.jobId)) {
      console.log('[MsgStudio] Message queued successfully:', response.data);
      return { success: true, data: response.data, jobId: response.data.jobId };
    } else {
      console.warn('[MsgStudio] Non-success response:', response.data);
      return { success: false, data: response.data, message: response.data?.message || 'Failed to dispatch' };
    }
  } catch (err) {
    const errMsg = err.response?.data?.message || err.response?.data || err.message;
    console.error('[MsgStudio] Dispatch error:', errMsg);
    return { success: false, error: errMsg };
  }
}

/**
 * High-level helper: Send student registration payment link via WhatsApp
 */
async function sendRegistrationLink({ studentPhone, studentName, registrationNo, payableAmount, paymentLink }) {
  if (!studentPhone) {
    return { success: false, message: 'Student phone number is required' };
  }

  return sendWhatsAppTemplate({
    mobile: studentPhone,
    variables: [
      studentName || 'Student',
      registrationNo || '',
      Number(payableAmount || 0).toLocaleString(),
      paymentLink || ''
    ]
  });
}

/**
 * High-level helper: Send student official registration/installment receipt via WhatsApp
 */
async function sendReceiptWhatsApp({ studentPhone, studentName, registrationNo, paidAmount, receiptUrl }) {
  if (!studentPhone) {
    return { success: false, message: 'Student phone number is required' };
  }

  const receiptTemplateName = process.env.MSGSTUDIO_RECEIPT_TEMPLATE_NAME;
  const receiptTemplateId = process.env.MSGSTUDIO_RECEIPT_TEMPLATE_ID;

  return sendWhatsAppTemplate({
    mobile: studentPhone,
    templateName: receiptTemplateName,
    templateId: receiptTemplateId,
    variables: [
      studentName || 'Student',
      registrationNo || '',
      `₹${Number(paidAmount || 0).toLocaleString()}`,
      sanitizePublicReceiptUrl(receiptUrl || '')
    ],
    mediaUrl: receiptUrl
  });
}

module.exports = {
  sendWhatsAppTemplate,
  sendRegistrationLink,
  sendReceiptWhatsApp
};


