const API_URL = 'https://restock-backend-zkrx.onrender.com/api';
let shops = [];
let selectedShopId = null;
let orders = [];
let allProducts = [];

// ============================================================
// LOAD SHOPS
// ============================================================
async function loadShops() {
    try {
        const res = await fetch(`${API_URL}/shops`);
        const data = await res.json();
        if (data.success) {
            shops = data.shops;
            const select = document.getElementById('shopSelect');
            select.innerHTML = '<option value="">-- Select a shop --</option>';
            shops.forEach(shop => {
                const opt = document.createElement('option');
                opt.value = shop._id;
                opt.textContent = shop.businessName;
                select.appendChild(opt);
            });
        }
    } catch (err) {
        console.error('Error loading shops:', err);
    }
}

// ============================================================
// LOAD DASHBOARD (UPDATED WITH DEBUG)
// ============================================================
async function loadDashboard() {
    const select = document.getElementById('shopSelect');
    selectedShopId = select.value;
    if (!selectedShopId) {
        document.getElementById('orderList').innerHTML =
            '<div class="empty-state">Select a shop to view orders</div>';
        document.getElementById('topProducts').innerHTML =
            '<div class="empty-state">Select a shop to see top products</div>';
        resetStats();
        loadCategories();
        return;
    }

    try {
        const res = await fetch(`${API_URL}/orders?shopId=${selectedShopId}`);
        const data = await res.json();
        if (data.success) {
            orders = data.orders;
            
            console.log('📦 Orders loaded:', orders);
            orders.forEach(order => {
                if (order.deliveryPIN) {
                    console.log(`🔑 Order ${order._id} has PIN: ${order.deliveryPIN}, status: ${order.status}`);
                } else {
                    console.log(`❌ Order ${order._id} has NO PIN, status: ${order.status}`);
                }
            });
            
            const filtered = filterOrdersByDate(orders);
            renderOrders(filtered);
            updateStats(filtered);
            renderTopProducts(filtered);
            loadCategories(filtered);
        }
    } catch (err) {
        console.error('Error loading orders:', err);
    }
}

// ============================================================
// FILTER BY DATE
// ============================================================
function filterOrdersByDate(orders) {
    const filter = document.getElementById('dateFilter').value;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    return orders.filter(order => {
        const orderDate = new Date(order.createdAt);
        const orderDay = new Date(orderDate.getFullYear(), orderDate.getMonth(), orderDate.getDate());

        if (filter === 'today') {
            return orderDay.getTime() === today.getTime();
        } else if (filter === 'week') {
            const weekAgo = new Date(today);
            weekAgo.setDate(weekAgo.getDate() - 7);
            return orderDay >= weekAgo;
        } else if (filter === 'month') {
            return orderDate.getMonth() === now.getMonth() &&
                   orderDate.getFullYear() === now.getFullYear();
        }
        return true; // 'all'
    });
}

// ============================================================
// FILTER BY CATEGORY
// ============================================================
function filterOrdersByCategory(orders) {
    const category = document.getElementById('categoryFilter').value;
    if (category === 'all') return orders;

    return orders.filter(order => {
        return order.items.some(item =>
            item.category === category || item.productName.includes(category)
        );
    });
}

// ============================================================
// LOAD CATEGORIES
// ============================================================
function loadCategories(orders) {
    const select = document.getElementById('categoryFilter');
    const categories = new Set();

    (orders || []).forEach(order => {
        order.items.forEach(item => {
            if (item.category) categories.add(item.category);
            // Also extract from product name as fallback
            const name = item.productName || '';
            if (name.includes('Indomie') || name.includes('Noodle')) categories.add('Noodles');
            else if (name.includes('Milk') || name.includes('Peak') || name.includes('Milo')) categories.add('Beverages');
            else if (name.includes('Rice')) categories.add('Grains');
            else if (name.includes('Sugar')) categories.add('Essentials');
            else if (name.includes('Tomato') || name.includes('Gino')) categories.add('Canned Goods');
        });
    });

    // Keep the current selection
    const current = select.value;
    select.innerHTML = '<option value="all">All Categories</option>';
    categories.forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat;
        opt.textContent = cat;
        select.appendChild(opt);
    });
    select.value = current;
}

// ============================================================
// RENDER ORDERS
// ============================================================
function renderOrders() {
    const container = document.getElementById('orderList');
    
    // Apply category filter
    const filtered = filterOrdersByCategory(orders);
    
    if (filtered.length === 0) {
        container.innerHTML = '<div class="empty-state">📭 No orders found</div>';
        return;
    }

    container.innerHTML = filtered.map(order => {
        const items = order.items.map(i =>
            `${i.productName} x${i.quantity}`
        ).join(', ');

        const totalItems = order.items.reduce((sum, i) => sum + i.quantity, 0);

        // ✅ PIN DISPLAY - Shows on the dashboard
        const showPin = order.deliveryPIN && (order.status === 'picked_up' || order.status === 'out_for_delivery');
        
        const pinDisplay = showPin ? `
            <div style="background: #E8F5E9; padding: 10px 14px; border-radius: 8px; margin-top: 8px; border: 2px solid #00B894;">
                <span style="font-weight: 700; color: #00B894;">🔑 Delivery PIN: </span>
                <span style="font-size: 24px; font-weight: 800; color: #00B894; letter-spacing: 4px;">${order.deliveryPIN}</span>
                <span style="font-size: 12px; color: #6C757D; margin-left: 12px;">Give this PIN to your rider</span>
            </div>
        ` : '';

        return `
            <div class="order-card">
                <div class="order-info">
                    <div class="order-id">#${order._id.slice(-6).toUpperCase()}</div>
                    <div class="order-items">${items}</div>
                    <div style="font-size:13px;color:var(--gray-500);">
                        📦 ${totalItems} items • 
                        ${new Date(order.createdAt).toLocaleDateString()} • 
                        ${new Date(order.createdAt).toLocaleTimeString()}
                    </div>
                    ${pinDisplay}
                </div>
                <div class="order-meta">
                    <div class="order-total">₦${order.total.toLocaleString()}</div>
                    <span class="order-status ${order.status}">${order.status.toUpperCase()}</span>
                    ${order.status === 'delivered' ? `<button class="reorder-btn" onclick="reorder('${order._id}')">🔄 Reorder</button>` : ''}
                </div>
            </div>
        `;
    }).join('');
}
// ============================================================
// RENDER TOP PRODUCTS
// ============================================================
function renderTopProducts(orders) {
    const container = document.getElementById('topProducts');
    const productMap = {};

    // Count product occurrences
    orders.forEach(order => {
        order.items.forEach(item => {
            const key = item.productName;
            if (!productMap[key]) {
                productMap[key] = { count: 0, total: 0 };
            }
            productMap[key].count += item.quantity;
            productMap[key].total += item.total || 0;
        });
    });

    const sorted = Object.entries(productMap)
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 5);

    if (sorted.length === 0) {
        container.innerHTML = '<div class="empty-state">No products ordered yet</div>';
        return;
    }

    container.innerHTML = sorted.map(([name, data]) => `
        <div class="top-product-card">
            <div>
                <div class="product-name">${name}</div>
                <div class="product-count">🛒 ${data.count} units</div>
            </div>
            <div class="product-total">₦${data.total.toLocaleString()}</div>
        </div>
    `).join('');
}

// ============================================================
// UPDATE STATS
// ============================================================
function updateStats(orders) {
    const total = orders.length;
    const pending = orders.filter(o => o.status === 'pending' || o.status === 'confirmed').length;
    const delivered = orders.filter(o => o.status === 'delivered').length;
    const spent = orders.reduce((sum, o) => sum + (o.total || 0), 0);

    document.getElementById('totalOrders').textContent = total;
    document.getElementById('pendingOrders').textContent = pending;
    document.getElementById('deliveredOrders').textContent = delivered;
    document.getElementById('totalSpent').textContent = `₦${spent.toLocaleString()}`;
}

function resetStats() {
    document.getElementById('totalOrders').textContent = '0';
    document.getElementById('pendingOrders').textContent = '0';
    document.getElementById('deliveredOrders').textContent = '0';
    document.getElementById('totalSpent').textContent = '₦0';
}

// ============================================================
// REORDER
// ============================================================
async function reorder(orderId) {
    try {
        const res = await fetch(`${API_URL}/orders/${orderId}`);
        const data = await res.json();
        if (data.success) {
            const order = data.order;
            // Create new order with same items
            const newOrder = {
                shopId: order.shopId._id,
                distributorId: order.distributorId?._id || order.distributorId,
                items: order.items.map(item => ({
                    productName: item.productName,
                    quantity: item.quantity,
                    price: item.price,
                    total: item.total
                })),
                subtotal: order.subtotal,
                deliveryFee: 0,
                total: order.total,
                paymentMethod: 'cash_on_delivery',
                deliveryAddress: order.deliveryAddress || {}
            };

            const placeRes = await fetch(`${API_URL}/orders`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newOrder)
            });

            const placeData = await placeRes.json();
            if (placeData.success) {
                showToast('✅ Reorder placed successfully!');
                loadDashboard();
            } else {
                showToast('❌ Failed to place reorder');
            }
        }
    } catch (err) {
        console.error('Error reordering:', err);
        showToast('❌ Error reordering');
    }
}

// ============================================================
// EXPORT CSV
// ============================================================
function exportCSV() {
    if (orders.length === 0) {
        showToast('No orders to export');
        return;
    }

    let csv = 'Order ID,Date,Items,Total,Status\n';
    orders.forEach(order => {
        const items = order.items.map(i => `${i.productName} x${i.quantity}`).join('; ');
        csv += `#${order._id.slice(-6).toUpperCase()},`;
        csv += `${new Date(order.createdAt).toLocaleDateString()},`;
        csv += `"${items}",`;
        csv += `${order.total},`;
        csv += `${order.status}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `orders_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    showToast('📥 CSV downloaded!');
}

// ============================================================
// GO TO SHOP
// ============================================================
function goToShop() {
    window.location.href = '../shop-app/index.html';
}

// ============================================================
// REFRESH
// ============================================================
function refreshData() {
    if (selectedShopId) loadDashboard();
    else loadShops();
    showToast('🔄 Refreshed!');
}

// ============================================================
// TOAST
// ============================================================
function showToast(message) {
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed; bottom: 20px; right: 20px;
        background: var(--gray-900); color: white;
        padding: 16px 24px; border-radius: var(--radius);
        font-weight: 500; z-index: 9999;
        max-width: 400px; box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        animation: slideIn 0.3s ease;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ============================================================
// LOGOUT
// ============================================================
function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '../landing-page/index.html';
}

// ============================================================
// INIT
// ============================================================
loadShops();