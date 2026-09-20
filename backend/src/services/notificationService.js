const Notification = require('../models/Notification');

// ============================================================
// CREATE NOTIFICATION
// ============================================================
// recipient: { id, role }
// type: string like 'order_confirmed'
// title: short bold headline
// body: optional description
// data: optional metadata for deep-linking (orderId, chatId, etc.)
// ============================================================
async function createNotification({ recipient, type, title, body = '', data = {} }) {
  try {
    if (!recipient || !recipient.id || !recipient.role) {
      console.warn('⚠️ createNotification: missing recipient');
      return null;
    }

    const notif = await Notification.create({
      recipientId: recipient.id,
      recipientRole: recipient.role,
      type,
      title,
      body,
      data,
      read: false,
      createdAt: new Date(),
    });

    console.log(`🔔 Notification created for ${recipient.role} ${recipient.id}: ${title}`);
    return notif;
  } catch (error) {
    console.error('❌ createNotification failed:', error.message);
    return null;
  }
}

// ============================================================
// CONVENIENCE HELPERS
// ============================================================

async function notifyShopOrderPlaced(shop, order) {
  return createNotification({
    recipient: { id: shop._id, role: 'shop' },
    type: 'order_placed',
    title: '📦 Order Placed',
    body: `Your order #${order._id.toString().slice(-6).toUpperCase()} was placed successfully.`,
    data: { orderId: order._id },
  });
}

async function notifyDistributorNewOrder(distributor, order) {
  return createNotification({
    recipient: { id: distributor._id, role: 'distributor' },
    type: 'new_order',
    title: '🆕 New Order Received',
    body: `Order #${order._id.toString().slice(-6).toUpperCase()} needs your confirmation.`,
    data: { orderId: order._id },
  });
}

async function notifyShopOrderConfirmed(shop, order) {
  return createNotification({
    recipient: { id: shop._id, role: 'shop' },
    type: 'order_confirmed',
    title: '✅ Order Confirmed',
    body: `Your order #${order._id.toString().slice(-6).toUpperCase()} has been confirmed.`,
    data: { orderId: order._id },
  });
}

async function notifyShopRiderAssigned(shop, order, riderName) {
  return createNotification({
    recipient: { id: shop._id, role: 'shop' },
    type: 'rider_assigned',
    title: '🏍️ Rider Assigned',
    body: `${riderName} is picking up your order #${order._id.toString().slice(-6).toUpperCase()}.`,
    data: { orderId: order._id },
  });
}

async function notifyRiderAssigned(rider, order) {
  return createNotification({
    recipient: { id: rider._id, role: 'rider' },
    type: 'delivery_assigned',
    title: '🚚 New Delivery Assigned',
    body: `Order #${order._id.toString().slice(-6).toUpperCase()} has been assigned to you.`,
    data: { orderId: order._id },
  });
}

async function notifyShopDelivered(shop, order) {
  return createNotification({
    recipient: { id: shop._id, role: 'shop' },
    type: 'order_delivered',
    title: '✅ Order Delivered',
    body: `Order #${order._id.toString().slice(-6).toUpperCase()} was delivered. Please rate your experience.`,
    data: { orderId: order._id },
  });
}

async function notifyOrderCancelled(recipient, order, cancelledByRole, reason) {
  return createNotification({
    recipient: { id: recipient._id, role: recipient.role },
    type: 'order_cancelled',
    title: '❌ Order Cancelled',
    body: `Order #${order._id.toString().slice(-6).toUpperCase()} was cancelled by ${cancelledByRole}. ${reason ? `Reason: ${reason}` : ''}`,
    data: { orderId: order._id },
  });
}

async function notifyChatMessage(recipient, order, senderName, preview) {
  return createNotification({
    recipient: { id: recipient._id, role: recipient.role },
    type: 'chat_message',
    title: `💬 New message from ${senderName}`,
    body: preview,
    data: { orderId: order._id },
  });
}

async function notifyAdminProductRequest(adminId, request) {
  return createNotification({
    recipient: { id: adminId, role: 'admin' },
    type: 'product_request',
    title: '📝 New Product Request',
    body: `A shop requested "${request.productName}".`,
    data: { requestId: request._id },
  });
}

module.exports = {
  createNotification,
  notifyShopOrderPlaced,
  notifyDistributorNewOrder,
  notifyShopOrderConfirmed,
  notifyShopRiderAssigned,
  notifyRiderAssigned,
  notifyShopDelivered,
  notifyOrderCancelled,
  notifyChatMessage,
  notifyAdminProductRequest,
};