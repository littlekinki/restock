const twilio = require('twilio');

const client = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
);

// ============================================================
// AUTO-CALL DISTRIBUTOR
// ============================================================
async function autoCallDistributor(phone, orderId) {
    try {
        // Format phone number (remove leading 0 if present)
        let formattedPhone = phone.replace(/\D/g, '');
        if (formattedPhone.startsWith('0')) {
            formattedPhone = '234' + formattedPhone.substring(1);
        }
        if (!formattedPhone.startsWith('234')) {
            formattedPhone = '234' + formattedPhone;
        }

        const message = `Hello, this is Restock. Order #${orderId} is waiting for your confirmation. Please check your dashboard.`;

        const call = await client.calls.create({
            url: 'https://handler.twilio.com/twiml/restock',
            to: `+${formattedPhone}`,
            from: process.env.TWILIO_PHONE_NUMBER
        });

        console.log(`📞 Auto-call initiated for ${phone}`);
        return call;

    } catch (error) {
        console.error('Auto-call error:', error);
        return null;
    }
}

module.exports = { autoCallDistributor };