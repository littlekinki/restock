const axios = require('axios');

// ============================================================
// SEND SMS VIA TERMII
// ============================================================
async function sendSMS(phone, message) {
    try {
        const cleanPhone = phone.replace(/\D/g, '').trim();
        let formattedPhone = cleanPhone;
        if (formattedPhone.startsWith('0')) {
            formattedPhone = '234' + formattedPhone.substring(1);
        }
        if (!formattedPhone.startsWith('234')) {
            formattedPhone = '234' + formattedPhone;
        }

        const apiKey = process.env.TERMII_API_KEY;

        
        const payload = {
            to: formattedPhone,
            from: 'OE Alert',     
            sms: message,
            type: 'plain',
            channel: 'dnd'         
        };

        console.log('📤 Sending SMS to:', formattedPhone);
        console.log('📤 Message:', message);

        const response = await axios.post(
            'https://api.termii.com/api/sms/send',
            payload,
            {
                headers: {
                    'Content-Type': 'application/json',
                    'api-key': apiKey
                }
            }
        );

        console.log('✅ SMS sent:', response.data);
        return response.data;

    } catch (error) {
        console.error('❌ SMS error:', error.response?.data || error.message);
        return { success: false, error: error.message };
    }
}

// ============================================================
// ORDER STATUS MESSAGES 
// ============================================================
function getOrderStatusMessage(order, status) {
    const orderId = `#${order._id.slice(-6).toUpperCase()}`;
    const total = `NGN ${order.total?.toLocaleString() || 0}`;

    const messages = {
        pending: `Dear Customer, your order ${orderId} has been placed! Total: ${total}. We'll notify you when confirmed. - Powered by Restock`,
        confirmed: `Dear Customer, your order ${orderId} has been confirmed! Total: ${total}. Delivery in progress. - Powered by Restock`,
        picked_up: `Dear Customer, your order ${orderId} has been picked up! Total: ${total}. Delivery in progress. - Powered by Restock`,
        out_for_delivery: `Dear Customer, your order ${orderId} is out for delivery! Expect it soon. - Powered by Restock`,
        delivered: `Dear Customer, your order ${orderId} has been delivered! Thank you for using Restock. - Powered by Restock`,
        cancelled: `Dear Customer, your order ${orderId} has been cancelled. Please contact support. - Powered by Restock`
    };

    return messages[status] || `Dear Customer, your order ${orderId} status: ${status.toUpperCase()}. - Powered by Restock`;
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