const API_URL = 'https://restock-backend-zkrx.onrender.com/api';
let shops = [];
let selectedShopId = null;
let orders = [];
let allProducts = [];

// ============================================================
// LOAD SHOPS (Auto-select logged-in shop)
// ============================================================
async function loadShops() {
    try {
        const token = localStorage.getItem('token');
        const user = JSON.parse(localStorage.getItem('user') || 'null');

        if (!token || !user) {
            console.log('⚠️ No user logged in. Redirecting...');
            window.location.href = '../landing-page/index.html';
            return;
        }

        const res = await fetch(`${API_URL}/shops`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        if (data.success) {
            shops = data.shops;
            
            const myShop = shops.find(s => s._id === user.id);
            
            if (myShop) {
                selectedShopId = myShop._id;
                console.log('✅ Auto-selected shop:', myShop.businessName);
                
                const shopNameEl = document.getElementById('currentShopName');
                if (shopNameEl) {
                    shopNameEl.textContent = myShop.businessName;
                }
                
                const selector = document.querySelector('.shop-selector');
                if (selector) selector.style.display = 'none';
                
                loadDashboard();
            } else {
                const select = document.getElementById('shopSelect');
                if (select) {
                    select.innerHTML = '<option value="">-- Select a shop --</option>';
                    shops.forEach(shop => {
                        const opt = document.createElement('option');
                        opt.value = shop._id;
                        opt.textContent = shop.businessName;
                        select.appendChild(opt);
                    });
                }
            }
        }
    } catch (err) {
        console.error('Error loading shops:', err);
    }
}

// ============================================================
// LOAD DASHBOARD
// ============================================================
async function loadDashboard() {
    if (!selectedShopId) {
        const user = JSON.parse(localStorage.getItem('user') || 'null');
        if (user && user.id) {
            selectedShopId = user.id;
        }
    }

    if (!selectedShopId) {
        document.getElementById('orderList').innerHTML =
            '<div class="empty-state">No shop data available</div>';
        resetStats();
        return;
    }

    try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_URL}/orders?shopId=${selectedShopId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success) {
            orders = data.orders;
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
    const dateFilter = document.getElementById('dateFilter');
    if (!dateFilter) return orders;
    
    const filter = dateFilter.value;
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
        return true;
    });
}

// ============================================================
// FILTER BY CATEGORY
// ============================================================
function filterOrdersByCategory(orders) {
    const categoryFilter = document.getElementById('categoryFilter');
    if (!categoryFilter) return orders;
    
    const category = categoryFilter.value;
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
    if (!select) return;
    
    const categories = new Set();

    (orders || []).forEach(order => {
        order.items.forEach(item => {
            if (item.category) categories.add(item.category);
            const name = item.productName || '';
            if (name.includes('Indomie') || name.includes('Noodle')) categories.add('Noodles');
            else if (name.includes('Milk') || name.includes('Peak') || name.includes('Milo')) categories.add('Beverages');
            else if (name.includes('Rice')) categories.add('Grains');
            else if (name.includes('Sugar')) categories.add('Essentials');
            else if (name.includes('Tomato') || name.includes('Gino')) categories.add('Canned Goods');
        });
    });

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
function renderOrders(ordersToRender) {
    const container = document.getElementById('orderList');
    if (!container) return;
    
    const dataToUse = ordersToRender || orders;
    const filtered = filterOrdersByCategory(dataToUse);
    
    if (filtered.length === 0) {
        container.innerHTML = '<div class="empty-state">📭 No orders found</div>';
        return;
    }

    container.innerHTML = filtered.map(order => {
        const items = order.items.map(i =>
            `${i.productName} x${i.quantity}`
        ).join(', ');

        const totalItems = order.items.reduce((sum, i) => sum + i.quantity, 0);

        const showPin = order.deliveryPIN && (order.status === 'picked_up' || order.status === 'out_for_delivery');
        
        const pinDisplay = showPin ? `
            <div style="background: #E8F5E9; padding: 10px 14px; border-radius: 8px; margin-top: 8px; border: 2px solid #4DBE18;">
                <span style="font-weight: 700; color: #4DBE18;">🔑 Delivery PIN: </span>
                <span style="font-size: 24px; font-weight: 800; color: #4DBE18; letter-spacing: 4px;">${order.deliveryPIN}</span>
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
                    ${order.status === 'delivered' ? `
                        <button class="reorder-btn" onclick="reorder('${order._id}')">
                            🔄 Reorder
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');
}

// ============================================================
// RENDER TOP PRODUCTS
// ============================================================
function renderTopProducts(ordersToRender) {
    const container = document.getElementById('topProducts');
    if (!container) return;
    
    const productMap = {};

    ordersToRender.forEach(order => {
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
function updateStats(ordersToUse) {
    const total = ordersToUse.length;
    const pending = ordersToUse.filter(o => o.status === 'pending' || o.status === 'confirmed').length;
    const delivered = ordersToUse.filter(o => o.status === 'delivered').length;
    const spent = ordersToUse.reduce((sum, o) => sum + (o.total || 0), 0);

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
// REORDER - Copy items from past order to Shop App cart
// ============================================================
async function reorder(orderId) {
    try {
        const token = localStorage.getItem('token');
        const user = JSON.parse(localStorage.getItem('user') || '{}');

        console.log('🔄 Reordering order:', orderId);

        const response = await fetch(`${API_URL}/orders/${orderId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();

        if (!data.success) {
            showToast('❌ Failed to load order details');
            return;
        }

        const order = data.order;

        if (!order.items || order.items.length === 0) {
            showToast('⚠️ This order has no items');
            return;
        }

        const cartData = order.items.map(item => ({
            name: item.productName,
            price: item.price,
            quantity: item.quantity,
            distributorId: order.distributorId?._id || order.distributorId,
            distributorName: order.distributorId?.businessName || 'Previous Distributor',
            stock: 100
        }));

        localStorage.setItem('reorderCart', JSON.stringify({
            items: cartData,
            shopId: order.shopId?._id || order.shopId,
            originalOrderId: orderId
        }));

        console.log('✅ Cart data saved for reorder:', cartData);

        const port = window.location.port || '5500';
        const hostname = window.location.hostname;
        window.location.href = `http://${hostname}:${port}/shop-app/index.html?reorder=true`;

    } catch (error) {
        console.error('❌ Reorder error:', error);
        showToast('❌ Failed to reorder');
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
    const port = window.location.port || '5500';
    const hostname = window.location.hostname;
    window.location.href = `http://${hostname}:${port}/shop-app/index.html`;
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
// SHOW SECTION (Dashboard / Settings)
// ============================================================
function showSection(section) {
    const settingsSection = document.getElementById('settingsSection');
    const dashboardSection = document.getElementById('dashboardSection');

    const banner = document.querySelector('.shop-now-banner');
    if (banner) banner.style.display = 'flex';

    if (section === 'settings') {
        if (dashboardSection) dashboardSection.style.display = 'none';
        if (settingsSection) {
            settingsSection.style.display = 'block';
            loadSettingsData();
        }
    } else {
        if (settingsSection) settingsSection.style.display = 'none';
        if (dashboardSection) dashboardSection.style.display = 'block';
        loadDashboard();
    }
}

// ============================================================
// LOAD SETTINGS DATA
// ============================================================
async function loadSettingsData() {
    try {
        const token = localStorage.getItem('token');
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        
        const response = await fetch(`${API_URL}/shops`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        
        if (data.success) {
            const shop = data.shops.find(s => s._id === user.id);
            if (shop) {
                const setVal = (id, val) => {
                    const el = document.getElementById(id);
                    if (el) el.value = val || '';
                };
                
                setVal('settingsBusinessName', shop.businessName);
                setVal('settingsOwnerName', shop.ownerName);
                setVal('settingsPhone', shop.phone);
                setVal('settingsEmail', shop.email);
                setVal('settingsStreet', shop.address?.street);
                setVal('settingsCity', shop.address?.city);
                setVal('settingsState', shop.address?.state);
                setVal('settingsLandmark', shop.address?.landmark);
            }
        }
    } catch (error) {
        console.error('Error loading settings:', error);
    }
}

// ============================================================
// SAVE PROFILE
// ============================================================
async function saveProfile(event) {
    event.preventDefault();
    await updateShopSettings({
        businessName: document.getElementById('settingsBusinessName').value,
        ownerName: document.getElementById('settingsOwnerName').value,
        phone: document.getElementById('settingsPhone').value,
        email: document.getElementById('settingsEmail').value
    }, 'Profile saved successfully!');
}

// ============================================================
// SAVE ADDRESS
// ============================================================
async function saveAddress(event) {
    event.preventDefault();
    await updateShopSettings({
        address: {
            street: document.getElementById('settingsStreet').value,
            city: document.getElementById('settingsCity').value,
            state: document.getElementById('settingsState').value,
            landmark: document.getElementById('settingsLandmark').value
        }
    }, 'Address saved successfully!');
}

// ============================================================
// UPDATE SHOP SETTINGS (Helper)
// ============================================================
async function updateShopSettings(updates, successMessage) {
    try {
        const token = localStorage.getItem('token');
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        
        const shopResponse = await fetch(`${API_URL}/shops`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const shopData = await shopResponse.json();
        
        const shop = shopData.shops.find(s => s._id === user.id);
        if (!shop) {
            showToast('❌ Shop not found');
            return;
        }

        const mergedData = {
            ...shop,
            ...updates,
            address: updates.address 
                ? { ...shop.address, ...updates.address }
                : shop.address
        };

        const response = await fetch(`${API_URL}/shops/${shop._id}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(mergedData)
        });

        const data = await response.json();
        if (data.success) {
            showToast('✅ ' + successMessage);
            
            if (updates.businessName || updates.phone) {
                const updatedUser = {
                    ...user,
                    name: updates.businessName || user.name,
                    phone: updates.phone || user.phone
                };
                localStorage.setItem('user', JSON.stringify(updatedUser));
            }
        } else {
            showToast('❌ Failed: ' + (data.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error updating settings:', error);
        showToast('❌ Failed to save settings');
    }
}

// ============================================================
// CHANGE PASSWORD
// ============================================================
async function changePassword(event) {
    event.preventDefault();
    
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    
    if (!currentPassword || !newPassword || !confirmPassword) {
        showToast('⚠️ Please fill in all password fields');
        return;
    }
    
    if (newPassword !== confirmPassword) {
        showToast('⚠️ New passwords do not match');
        return;
    }
    
    if (newPassword.length < 6) {
        showToast('⚠️ Password must be at least 6 characters');
        return;
    }
    
    try {
        const token = localStorage.getItem('token');
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        
        const response = await fetch(`${API_URL}/auth/change-password`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                userId: user.id,
                role: 'shop',
                currentPassword: currentPassword,
                newPassword: newPassword
            })
        });
        
        const data = await response.json();
        if (data.success) {
            showToast('✅ Password changed successfully!');
            document.getElementById('passwordForm').reset();
        } else {
            showToast('❌ ' + (data.error || 'Failed to change password'));
        }
    } catch (error) {
        console.error('Error changing password:', error);
        showToast('❌ Failed to change password');
    }
}

// ============================================================
// DEACTIVATE ACCOUNT
// ============================================================
function deactivateAccount() {
    if (confirm('⚠️ Are you sure you want to deactivate your account? This action cannot be undone.')) {
        if (confirm('🚨 This is your last chance. Deactivate permanently?')) {
            showToast('⚠️ Account deactivation coming soon. Contact support.');
        }
    }
}

// ============================================================
// INIT
// ============================================================
loadShops();