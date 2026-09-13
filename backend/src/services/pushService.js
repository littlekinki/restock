const { Expo } = require('expo-server-sdk');
const expo = new Expo();

// ============================================================
// SEND PUSH NOTIFICATION
// ============================================================
async function sendPushNotification(pushToken, title, body, data = {}) {
    if (!pushToken || !Expo.isExpoPushToken(pushToken)) {
        console.log('Invalid push token:', pushToken);
        return;
    }

    const message = {
        to: pushToken,
        sound: 'default',
        title,
        body,
        data,
    };

    try {
        const ticket = await expo.sendPushNotificationsAsync([message]);
        console.log('Push sent:', ticket);
        return ticket;
    } catch (error) {
        console.error('Push error:', error);
    }
}

module.exports = { sendPushNotification };