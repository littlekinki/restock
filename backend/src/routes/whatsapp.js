const express = require('express');
const router = express.Router();
const axios = require('axios');
const Order = require('../models/Order');
const Shop = require('../models/Shop');
const Distributor = require('../models/Distributor');

console.log('✅ WhatsApp routes loaded!');

// ============================================================
// TEST ROUTE - GET /whatsapp/test
// ============================================================
router.get('/test', (req, res) => {
    res.json({ 
        status: 'ok', 
        message: 'WhatsApp route is working!',
        timestamp: new Date().toISOString()
    });
});

// ============================================================
// VERIFY WEBHOOK - GET /whatsapp/webhook
// ============================================================
router.get('/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'restock_verify_2026';

    console.log('🔍 Webhook verification request:');
    console.log('Mode:', mode);
    console.log('Token:', token);
    console.log('Expected:', VERIFY_TOKEN);

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
        console.log('✅ WhatsApp webhook verified!');
        res.status(200).send(challenge);
    } else {
        console.error('❌ Webhook verification failed');
        res.sendStatus(403);
    }
});

// ============================================================
// RECEIVE MESSAGES - POST /whatsapp/webhook
// ============================================================
router.post('/webhook', async (req, res) => {
    try {
        console.log('📨 Webhook POST received!');  // ← ADD THIS
        console.log('📨 Full body:', JSON.stringify(req.body, null, 2));  // ← ADD THIS

        const body = req.body;

        if (body.object === 'whatsapp_business_account') {
            const entry = body.entry[0];
            const changes = entry.changes[0];
            const value = changes.value;

            const message = value.messages && value.messages[0];
            const contact = value.contacts && value.contacts[0];

            if (message && contact) {
                const from = message.from;
                const text = message.text?.body || '';

                console.log(`📨 Message from ${from}: ${text}`);

                // Process the message
                await processWhatsAppMessage(from, text);
            } else {
                console.log('📨 No message or contact found in webhook');
            }
        } else {
            console.log('📨 Not a WhatsApp business account webhook');
        }

        res.sendStatus(200);
    } catch (error) {
        console.error('❌ Error processing webhook:', error);
        res.sendStatus(500);
    }
});

// ============================================================
// PROCESS WHATSAPP MESSAGE
// ============================================================
const userSessions = {};

async function processWhatsAppMessage(phone, text) {
    try {
        const normalizedPhone = phone.replace('+', '').trim();

        // Check if shop exists
        let shop = await Shop.findOne({ phone: normalizedPhone });

        // If shop doesn't exist, prompt them to register
        if (!shop) {
            await sendWhatsAppMessage(phone, `👋 Welcome to Restock!

You're not registered yet. Please reply with:

1️⃣ Your shop name
2️⃣ Your full name

Example: "Maryland Supermarket, Chidi Okonkwo"`);
            return;
        }

        // Get or create user session
        if (!userSessions[phone]) {
            userSessions[phone] = { step: 'main', cart: [] };
        }

        const session = userSessions[phone];
        const lowerText = text.toLowerCase().trim();

        // ============================================================
        // MAIN MENU
        // ============================================================
        if (session.step === 'main') {
            if (lowerText.includes('order') || lowerText.includes('buy') || lowerText.includes('need')) {
                const result = parseOrderText(text);
                if (result) {
                    session.step = 'searching';
                    session.searchTerm = result.product;
                    session.searchQty = result.quantity;

                    // Search for distributors
                    const distributors = await Distributor.find({
                        'products.name': { $regex: result.product, $options: 'i' }
                    });

                    if (distributors.length === 0) {
                        await sendWhatsAppMessage(phone, `❌ Sorry, we couldn't find "${result.product}".

Try:
• "Indomie Super Pack"
• "Peak Milk"
• "Rice"
• Or type "menu" to see options`);
                        session.step = 'main';
                        return;
                    }

                    // Build product list
                    let productList = `🔍 *Search Results for "${result.product}"*\n\n`;
                    let options = 1;

                    distributors.forEach(dist => {
                        dist.products.forEach(p => {
                            if (p.name.toLowerCase().includes(result.product.toLowerCase())) {
                                productList += `${options}. *${p.name}* - ₦${p.price.toLocaleString()}\n`;
                                productList += `   📍 ${dist.businessName} (${dist.address?.city || 'Unknown'})\n`;
                                productList += `   📦 ${p.stock || 0} in stock\n\n`;
                                options++;
                            }
                        });
                    });

                    productList += `\nReply with the *number* to order, or type *"cancel"* to go back.`;

                    await sendWhatsAppMessage(phone, productList);

                    session.searchResults = distributors;
                    session.step = 'selecting_product';

                } else {
                    await sendWhatsAppMessage(phone, `📦 What would you like to order?

Examples:
• "I need 2 cartons of Indomie Super Pack"
• "Buy 5 Peak Milk"
• "1 bag of Rice"

Or type "menu" to see what's available.`);
                }
                return;
            }

            if (lowerText === 'menu' || lowerText === 'help') {
                await sendWhatsAppMessage(phone, `📋 *Restock Menu*

1️⃣ *Order* - Tell me what you need
   Example: "I need 2 Indomie Super Pack"

2️⃣ *Track* - Check order status
   Reply: "track #RS1025"

3️⃣ *History* - View your past orders

4️⃣ *Help* - Show this menu

What would you like to do?`);
                return;
            }

            if (lowerText.includes('track')) {
                const orderId = text.match(/#([A-Z0-9]+)/i);
                if (orderId) {
                    const order = await Order.findOne({
                        _id: { $regex: orderId[1], $options: 'i' }
                    }).populate('shopId').populate('distributorId').populate('riderId');

                    if (order) {
                        await sendWhatsAppMessage(phone, `📦 *Order Status*

Order: #${order._id.slice(-6).toUpperCase()}
Status: ${order.status?.toUpperCase() || 'PENDING'}
Shop: ${order.shopId?.businessName || 'Unknown'}
Distributor: ${order.distributorId?.businessName || 'Unknown'}
Rider: ${order.riderId?.fullName || 'Not assigned yet'}
Total: ₦${order.total?.toLocaleString() || 0}`);
                    } else {
                        await sendWhatsAppMessage(phone, `❌ Order not found. Please check the order number.`);
                    }
                } else {
                    await sendWhatsAppMessage(phone, `📋 To track an order, reply: "track #ORDERID"`);
                }
                return;
            }

            if (lowerText === 'history') {
                const orders = await Order.find({ shopId: shop._id })
                    .sort({ createdAt: -1 })
                    .limit(5);

                if (orders.length === 0) {
                    await sendWhatsAppMessage(phone, `📭 You haven't placed any orders yet.`);
                } else {
                    let historyMsg = `📋 *Your Recent Orders*\n\n`;
                    orders.forEach((o, i) => {
                        historyMsg += `${i + 1}. #${o._id.slice(-6).toUpperCase()} - ₦${o.total?.toLocaleString()} - ${o.status?.toUpperCase()}\n`;
                    });
                    historyMsg += `\nReply "track #ORDERID" to see full details.`;
                    await sendWhatsAppMessage(phone, historyMsg);
                }
                return;
            }

            await sendWhatsAppMessage(phone, `🤔 I didn't understand that.

Try:
• "I need [product]" to order
• "menu" to see options
• "help" for assistance`);
        }

        // ============================================================
        // SELECTING PRODUCT
        // ============================================================
        else if (session.step === 'selecting_product') {
            if (lowerText === 'cancel') {
                session.step = 'main';
                session.searchResults = [];
                await sendWhatsAppMessage(phone, `✅ Order cancelled. How can I help you?`);
                return;
            }

            const selection = parseInt(text);
            if (!isNaN(selection)) {
                const results = session.searchResults || [];
                let selectedProduct = null;
                let selectedDistributor = null;
                let count = 1;

                for (const dist of results) {
                    for (const p of dist.products) {
                        if (count === selection) {
                            selectedProduct = p;
                            selectedDistributor = dist;
                            break;
                        }
                        count++;
                    }
                    if (selectedProduct) break;
                }

                if (selectedProduct && selectedDistributor) {
                    const shop = await Shop.findOne({ phone: normalizedPhone });
                    if (!shop) {
                        await sendWhatsAppMessage(phone, `❌ Shop not found. Please register first.`);
                        session.step = 'main';
                        return;
                    }

                    const quantity = session.searchQty || 1;
                    const total = selectedProduct.price * quantity;

                    const order = new Order({
                        shopId: shop._id,
                        distributorId: selectedDistributor._id,
                        items: [{
                            productName: selectedProduct.name,
                            quantity: quantity,
                            price: selectedProduct.price,
                            total: total
                        }],
                        subtotal: total,
                        deliveryFee: 0,
                        total: total,
                        status: 'pending',
                        paymentMethod: 'cash_on_delivery',
                        deliveryAddress: {
                            shopName: shop.businessName,
                            address: shop.address?.street || '',
                            city: shop.address?.city || '',
                            state: shop.address?.state || ''
                        },
                        pickupAddress: {
                            distributorName: selectedDistributor.businessName,
                            address: selectedDistributor.address?.street || '',
                            city: selectedDistributor.address?.city || '',
                            state: selectedDistributor.address?.state || '',
                            phone: selectedDistributor.phone
                        },
                        trackingUpdates: [{
                            status: 'pending',
                            note: 'Order placed via WhatsApp'
                        }]
                    });

                    await order.save();

                    await sendWhatsAppMessage(phone, `✅ *Order Placed!*

📦 ${quantity}x ${selectedProduct.name}
💰 ₦${total.toLocaleString()}
🏪 From: ${selectedDistributor.businessName}

Order #${order._id.slice(-6).toUpperCase()}
Status: PENDING

You'll receive updates as your order is processed.`);
                    session.step = 'main';
                    session.searchResults = [];
                } else {
                    await sendWhatsAppMessage(phone, `❌ Invalid selection. Please reply with the number.`);
                }
            } else {
                await sendWhatsAppMessage(phone, `❌ Please reply with the number of the product you want to order.`);
            }
            return;
        }

        // ============================================================
        // REGISTRATION
        // ============================================================
        else if (session.step === 'registering') {
            const parts = text.split(',');
            if (parts.length >= 2) {
                const businessName = parts[0].trim();
                const ownerName = parts[1].trim();

                const newShop = new Shop({
                    businessName: businessName,
                    ownerName: ownerName,
                    phone: normalizedPhone,
                    address: {
                        city: 'Lagos',
                        state: 'Lagos'
                    }
                });

                await newShop.save();

                await sendWhatsAppMessage(phone, `✅ *Registration Complete!*

🏪 Shop: ${businessName}
👤 Owner: ${ownerName}

You can now place orders by replying:
"I need [product]"

Example: "I need 2 cartons of Indomie Super Pack"`);
                session.step = 'main';
            } else {
                await sendWhatsAppMessage(phone, `❌ Please provide both your shop name and owner name.

Example: "Maryland Supermarket, Chidi Okonkwo"`);
            }
            return;
        }

    } catch (error) {
        console.error('❌ Error processing message:', error);
        await sendWhatsAppMessage(phone, `❌ Sorry, something went wrong. Please try again later.`);
    }
}

// ============================================================
// PARSE ORDER TEXT
// ============================================================
function parseOrderText(text) {
    const patterns = [
        /(\d+)\s*(?:cartons?|bags?|packs?|pieces?|units?)?\s*(?:of\s*)?([^,]+)/i,
        /(?:need|buy|get|order)\s*(\d+)\s*(?:cartons?|bags?|packs?|pieces?|units?)?\s*(?:of\s*)?([^,]+)/i,
        /(\d+)\s*x\s*([^,]+)/i,
    ];

    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
            return {
                quantity: parseInt(match[1]) || 1,
                product: match[2]?.trim() || text.trim()
            };
        }
    }

    const productMatch = text.match(/(?:need|buy|get|order)\s*(.+)/i);
    if (productMatch) {
        return {
            quantity: 1,
            product: productMatch[1]?.trim() || text.trim()
        };
    }

    return null;
}

// ============================================================
// SEND WHATSAPP MESSAGE
// ============================================================
async function sendWhatsAppMessage(to, message) {
    try {
        const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
        const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

        const url = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`;

        const payload = {
            messaging_product: 'whatsapp',
            to: to,
            type: 'text',
            text: { body: message }
        };

        const response = await axios.post(url, payload, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        });

        console.log(`✅ WhatsApp message sent to ${to}`);
        return response.data;

    } catch (error) {
        console.error('❌ Error sending WhatsApp message:', error);
        console.error('Response:', error.response?.data);
        throw error;
    }
}

module.exports = router;