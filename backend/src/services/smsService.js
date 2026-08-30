const axios = require('axios');

// ============================================================
// SEND SMS VIA TERMII 
// ============================================================
async function sendSMS(phone, message) {
    try {
        // Remove any special characters from phone
        const cleanPhone = phone.replace(/\D/g, '').trim();
        
        // Ensure Nigerian format (remove leading 0 if present)
        let formattedPhone = cleanPhone;
        if (formattedPhone.startsWith('0')) {
            formattedPhone = '234' + formattedPhone.substring(1);
        }
        if (!formattedPhone.startsWith('234')) {
            formattedPhone = '234' + formattedPhone;
        }

        const apiKey = process.env.TERMII_API_KEY;
        const senderId = process.env.TERMII_SENDER_ID || 'Restock';

        console.log('📤 Sending SMS to:', formattedPhone);
        console.log('📤 Message:', message);
        console.log('🔑 API Key (first 10 chars):', apiKey ? apiKey.substring(0, 10) + '...' : '❌ No');

        
        const payload = {
            to: formattedPhone,
            from: senderId,
            sms: message,
            type: 'plain',
            channel: 'generic'
        };

        console.log('📦 Payload:', JSON.stringify(payload, null, 2));

        const response = await axios({
            method: 'post',
            url: 'https://api.termii.com/api/sms/send',
            headers: {
                'Content-Type': 'application/json',
                'api-key': apiKey  // ← Termii uses 'api-key' header
            },
            data: payload
        });

        console.log('✅ SMS sent:', response.data);
        return response.data;

    } catch (error) {
        console.error('❌ SMS error:', error.response?.data || error.message);
        if (error.response) {
            console.error('📡 Status:', error.response.status);
            console.error('📡 Headers:', error.response.headers);
        }
        return { success: false, error: error.message };
    }
}

// ============================================================
// ORDER STATUS MESSAGES
// ============================================================
function getOrderStatusMessage(order, status) {
    const shopName = order.shopId?.businessName || 'Your shop';
    const orderId = `#${order._id.slice(-6).toUpperCase()}`;
    const total = `₦${order.total?.toLocaleString() || 0}`;

    const messages = {
        pending: `📦 ${shopName}, your order ${orderId} has been placed! Total: ${total}. We'll notify you when it's confirmed.`,
        confirmed: `✅ ${shopName}, your order ${orderId} has been confirmed by the distributor! Total: ${total}. Preparing for delivery.`,
        picked_up: `🚚 ${shopName}, your order ${orderId} has been picked up by a rider! Delivery in progress.`,
        out_for_delivery: `🚚 ${shopName}, your order ${orderId} is out for delivery! Expect it soon.`,
        delivered: `✅ ${shopName}, your order ${orderId} has been delivered! Thank you for using Restock. Please rate your experience.`,
        cancelled: `❌ ${shopName}, your order ${orderId} has been cancelled. Please contact support for assistance.`
    };

    return messages[status] || `📦 ${shopName}, your order ${orderId} status: ${status.toUpperCase()}`;
}

// ============================================================
// NOTIFY SHOP ON ORDER UPDATE
// ============================================================
async function notifyShopOrderUpdate(order, status) {
    try {
        const shop = order.shopId;
        if (!shop || !shop.phone) {
            console.log('⚠️ No shop phone found for SMS notification');
            return;
        }

        const message = getOrderStatusMessage(order, status);
        await sendSMS(shop.phone, message);
        console.log(`✅ SMS notification sent to ${shop.phone} for order ${order._id}`);

    } catch (error) {
        console.error('❌ SMS notification error:', error);
    }
}

module.exports = {
    sendSMS,
    getOrderStatusMessage,
    notifyShopOrderUpdate
};