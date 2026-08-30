require('dotenv').config();
const smsService = require('./src/services/smsService');

async function testSMS() {
    console.log('🔑 API Key found:', process.env.TERMII_API_KEY ? '✅ Yes' : '❌ No');
    console.log('🔑 API Key (first 10 chars):', process.env.TERMII_API_KEY ? process.env.TERMII_API_KEY.substring(0, 10) + '...' : '❌ No');
    console.log('📤 Sending test SMS...');
    
    
    const phone = '09152565045'; 
    const message = '🧪 Restock test SMS! Your platform is working!';

    const result = await smsService.sendSMS(phone, message);
    console.log('📥 Result:', JSON.stringify(result, null, 2));
}

testSMS();