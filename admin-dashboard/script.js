// ============================================================
// API Configuration
// ============================================================
const API_URL = 'https://restock-backend-zkrx.onrender.com/api';
let orders = [];
let shops = [];
let distributors = [];
let riders = [];
let ordersChart = null;
let revenueChart = null;

// ============================================================
// AUTHENTICATION
// ============================================================
function checkAuth() {
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    
    if (!token || !user) {
        window.location.href = '../landing-page/index.html';
        return false;
    }
    
    return true;
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '../landing-page/index.html';
}

// ============================================================
// FETCH DATA
// ============================================================
async function fetchData() {
    try {
        const token = localStorage.getItem('token');
        
        const [ordersRes, shopsRes, distributorsRes, ridersRes] = await Promise.all([
            fetch(`${API_URL}/orders`, { headers: { 'Authorization': `Bearer ${token}` } }),
            fetch(`${API_URL}/shops`, { headers: { 'Authorization': `Bearer ${token}` } }),
            fetch(`${API_URL}/distributors`, { headers: { 'Authorization': `Bearer ${token}` } }),
            fetch(`${API_URL}/riders`, { headers: { 'Authorization': `Bearer ${token}` } })
        ]);
        
        const ordersData = await ordersRes.json();
        const shopsData = await shopsRes.json();
        const distributorsData = await distributorsRes.json();
        const ridersData = await ridersRes.json();
        
        if (ordersData.success) orders = ordersData.orders || [];
        if (shopsData.success) shops = shopsData.shops || [];
        if (distributorsData.success) distributors = distributorsData.distributors || [];
        if (ridersData.success) riders = ridersData.riders || [];
        
        updateStats();
        updateStatusBreakdown();
        updateTopProducts();
        updateRecentOrders();
        updateCharts();
        updateLastUpdated();
        loadProductRequests(); // Load requests for badge
        
    } catch (error) {
        console.error('Error fetching data:', error);
        showToast('Failed to load dashboard data');
    }
}

// ============================================================
// UPDATE STATS
// ============================================================
function updateStats() {
    const totalOrders = orders.length;
    const totalRevenue = orders.reduce((sum, o) => sum + (o.total || 0), 0);
    const activeShops = new Set(orders.map(o => o.shopId?._id).filter(Boolean)).size;
    const activeDistributors = new Set(orders.map(o => o.distributorId?._id).filter(Boolean)).size;
    const activeRiders = new Set(orders.map(o => o.riderId?._id).filter(Boolean)).size;
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    
    document.getElementById('totalOrders').textContent = totalOrders;
    document.getElementById('totalRevenue').textContent = `₦${totalRevenue.toLocaleString()}`;
    document.getElementById('activeShops').textContent = activeShops;
    document.getElementById('activeDistributors').textContent = activeDistributors;
    document.getElementById('activeRiders').textContent = activeRiders;
    document.getElementById('avgOrderValue').textContent = `₦${avgOrderValue.toLocaleString()}`;
}

// ============================================================
// UPDATE STATUS BREAKDOWN
// ============================================================
function updateStatusBreakdown() {
    const statuses = {
        pending: 0,
        confirmed: 0,
        picked_up: 0,
        delivered: 0,
        cancelled: 0
    };
    
    orders.forEach(o => {
        const status = o.status || 'pending';
        if (statuses[status] !== undefined) statuses[status]++;
    });
    
    document.getElementById('pendingCount').textContent = statuses.pending;
    document.getElementById('confirmedCount').textContent = statuses.confirmed;
    document.getElementById('pickedUpCount').textContent = statuses.picked_up;
    document.getElementById('deliveredCount').textContent = statuses.delivered;
    document.getElementById('cancelledCount').textContent = statuses.cancelled;
}

// ============================================================
// UPDATE TOP PRODUCTS
// ============================================================
function updateTopProducts() {
    const productMap = {};
    
    orders.forEach(order => {
        (order.items || []).forEach(item => {
            const key = item.productName;
            if (!productMap[key]) {
                productMap[key] = { count: 0, total: 0 };
            }
            productMap[key].count += item.quantity || 0;
            productMap[key].total += item.total || 0;
        });
    });
    
    const sorted = Object.entries(productMap)
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 5);
    
    const container = document.getElementById('topProducts');
    
    if (sorted.length === 0) {
        container.innerHTML = '<p style="color: var(--gray-500); font-size: 14px;">No products sold yet</p>';
        return;
    }
    
    container.innerHTML = sorted.map(([name, data]) => `
        <div class="status-item">
            <span>${name}</span>
            <span>${data.count} units • ₦${data.total.toLocaleString()}</span>
        </div>
    `).join('');
}

// ============================================================
// UPDATE RECENT ORDERS
// ============================================================
function updateRecentOrders() {
    const container = document.getElementById('recentOrdersList');
    const recent = orders.slice(0, 10);
    
    if (recent.length === 0) {
        container.innerHTML = '<p style="color: var(--gray-500); font-size: 14px;">No orders yet</p>';
        return;
    }
    
    container.innerHTML = recent.map(order => `
        <div class="order-row">
            <span class="shop">#${order._id.slice(-6).toUpperCase()}</span>
            <span>${order.shopId?.businessName || 'Unknown'}</span>
            <span class="amount">₦${(order.total || 0).toLocaleString()}</span>
            <span class="order-status-badge ${order.status || 'pending'}">${(order.status || 'pending').toUpperCase()}</span>
        </div>
    `).join('');
}

// ============================================================
// UPDATE CHARTS
// ============================================================
function updateCharts() {
    const dateMap = {};
    const revenueMap = {};
    
    orders.forEach(order => {
        const date = new Date(order.createdAt).toLocaleDateString();
        if (!dateMap[date]) {
            dateMap[date] = 0;
            revenueMap[date] = 0;
        }
        dateMap[date]++;
        revenueMap[date] += order.total || 0;
    });
    
    const labels = Object.keys(dateMap).slice(-7);
    const orderCounts = labels.map(d => dateMap[d] || 0);
    const revenueCounts = labels.map(d => revenueMap[d] || 0);
    
    const ctx1 = document.getElementById('ordersChart').getContext('2d');
    if (ordersChart) ordersChart.destroy();
    ordersChart = new Chart(ctx1, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Orders',
                data: orderCounts,
                backgroundColor: '#01311F',
                borderColor: '#002B1C',
                borderWidth: 1,
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
        }
    });
    
    const ctx2 = document.getElementById('revenueChart').getContext('2d');
    if (revenueChart) revenueChart.destroy();
    revenueChart = new Chart(ctx2, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Revenue (₦)',
                data: revenueCounts,
                backgroundColor: 'rgba(77, 190, 24, 0.1)',
                borderColor: '#4DBE18',
                borderWidth: 3,
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { callback: (value) => '₦' + value.toLocaleString() }
                }
            }
        }
    });
}

// ============================================================
// REFRESH
// ============================================================
function refreshData() {
    fetchData();
    showToast('🔄 Dashboard refreshed!');
}

function updateLastUpdated() {
    const now = new Date();
    const el = document.getElementById('lastUpdated');
    if (el) el.textContent = `Last updated: ${now.toLocaleTimeString()}`;
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
// SHOW SECTION
// ============================================================
function showSection(section) {
    // Hide all sections
    const sections = ['settingsSection', 'shopsSection', 'distributorsSection', 'ridersSection', 'ordersSection', 'requestsSection', 'earningsSection', 'notificationsSection', 'distProductsSection'];
    sections.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });

    // Hide dashboard content
    const statsContainer = document.getElementById('statsContainer');
    const chartsSection = document.querySelector('.charts-section');
    const statusSection = document.querySelector('.status-section');
    const recentOrders = document.querySelector('.recent-orders');

    // Update nav active state
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    if (event && event.currentTarget) {
        event.currentTarget.classList.add('active');
    }

    // Hide dashboard by default
    if (statsContainer) statsContainer.style.display = 'none';
    if (chartsSection) chartsSection.style.display = 'none';
    if (statusSection) statusSection.style.display = 'none';
    if (recentOrders) recentOrders.style.display = 'none';

    switch (section) {
        case 'dashboard':
            if (statsContainer) statsContainer.style.display = 'grid';
            if (chartsSection) chartsSection.style.display = 'grid';
            if (statusSection) statusSection.style.display = 'grid';
            if (recentOrders) recentOrders.style.display = 'block';
            break;

        case 'shops':
            const shopsSec = document.getElementById('shopsSection');
            if (shopsSec) shopsSec.style.display = 'block';
            loadAllShops();
            break;

        case 'distributors':
            const distSec = document.getElementById('distributorsSection');
            if (distSec) distSec.style.display = 'block';
            loadAllDistributors();
            break;

        case 'distProducts':
            const dpSec = document.getElementById('distProductsSection');
            if (dpSec) dpSec.style.display = 'block';
            loadDistributorDropdown();
            break;

        case 'riders':
            const riderSec = document.getElementById('ridersSection');
            if (riderSec) riderSec.style.display = 'block';
            loadAllRiders();
            break;

        case 'orders':
            const ordersSec = document.getElementById('ordersSection');
            if (ordersSec) ordersSec.style.display = 'block';
            loadAllOrders();
            break;

        case 'requests':
            const reqSec = document.getElementById('requestsSection');
            if (reqSec) reqSec.style.display = 'block';
            loadProductRequests();
            break;

        case 'earnings':
            const earningsSec = document.getElementById('earningsSection');
            if (earningsSec) earningsSec.style.display = 'block';
            loadEarnings();
            break;

        case 'notifications':
            const notifSec = document.getElementById('notificationsSection');
            if (notifSec) notifSec.style.display = 'block';
            loadNotifications();
            break;

        case 'settings':
            const settingsSec = document.getElementById('settingsSection');
            if (settingsSec) {
                settingsSec.style.display = 'block';
                loadAdminSettings();
            }
            break;
    }
}

// ============================================================
// LOAD ADMIN SETTINGS
// ============================================================
async function loadAdminSettings() {
    try {
        document.getElementById('totalShops').textContent = shops.length || 0;
        document.getElementById('totalDistributors').textContent = distributors.length || 0;
        document.getElementById('totalRiders').textContent = riders.length || 0;

        const settings = JSON.parse(localStorage.getItem('adminSettings') || '{}');
        
        if (settings.commission) document.getElementById('settingsCommission').value = settings.commission;
        if (settings.deliveryFee) document.getElementById('settingsDefaultDeliveryFee').value = settings.deliveryFee;
        if (settings.minOrder) document.getElementById('settingsMinOrder').value = settings.minOrder;
        if (settings.platformName) document.getElementById('settingsPlatformName').value = settings.platformName;
        
        if (settings.bankDetails) {
            document.getElementById('settingsBankName').value = settings.bankDetails.bankName || '';
            document.getElementById('settingsAccountNumber').value = settings.bankDetails.accountNumber || '';
            document.getElementById('settingsAccountName').value = settings.bankDetails.accountName || '';
        }
    } catch (error) {
        console.error('Error loading settings:', error);
    }
}

// ============================================================
// SAVE PLATFORM SETTINGS
// ============================================================
function savePlatformSettings(event) {
    event.preventDefault();
    
    const settings = JSON.parse(localStorage.getItem('adminSettings') || '{}');
    settings.commission = parseFloat(document.getElementById('settingsCommission').value) || 3;
    settings.deliveryFee = parseInt(document.getElementById('settingsDefaultDeliveryFee').value) || 1000;
    settings.minOrder = parseInt(document.getElementById('settingsMinOrder').value) || 5000;
    settings.platformName = document.getElementById('settingsPlatformName').value || 'Restock';
    
    localStorage.setItem('adminSettings', JSON.stringify(settings));
    showToast('✅ Platform settings saved!');
}

// ============================================================
// SAVE ADMIN BANK DETAILS
// ============================================================
function saveAdminBankDetails(event) {
    event.preventDefault();
    
    const settings = JSON.parse(localStorage.getItem('adminSettings') || '{}');
    settings.bankDetails = {
        bankName: document.getElementById('settingsBankName').value,
        accountNumber: document.getElementById('settingsAccountNumber').value,
        accountName: document.getElementById('settingsAccountName').value
    };
    
    localStorage.setItem('adminSettings', JSON.stringify(settings));
    showToast('✅ Bank details saved!');
}

// ============================================================
// SAVE ADMIN NOTIFICATIONS
// ============================================================
function saveAdminNotifications() {
    const settings = JSON.parse(localStorage.getItem('adminSettings') || '{}');
    settings.notifications = {
        sms: document.getElementById('adminSmsNotifications').checked,
        whatsapp: document.getElementById('adminWhatsappNotifications').checked
    };
    
    localStorage.setItem('adminSettings', JSON.stringify(settings));
    showToast('✅ Notification settings saved!');
}

// ============================================================
// VIEW ALL USERS
// ============================================================
function viewAllUsers() {
    showToast(`👥 ${shops.length} shops, ${distributors.length} distributors, ${riders.length} riders`);
}

// ============================================================
// DEACTIVATE PLATFORM
// ============================================================
function deactivatePlatform() {
    if (confirm('⚠️ Are you sure you want to deactivate the platform? All users will lose access.')) {
        if (confirm('🚨 This is your last chance. Deactivate permanently?')) {
            showToast('⚠️ Platform deactivation is not available in this version.');
        }
    }
}

// ============================================================
// LOAD ALL SHOPS
// ============================================================
async function loadAllShops() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/shops`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();

        if (data.success) {
            const shopsList = data.shops || [];
            document.getElementById('shopsCount').textContent = shopsList.length;

            if (shopsList.length === 0) {
                document.getElementById('shopsList').innerHTML = `
                    <div class="empty-state">
                        <p>🏪</p>
                        <p>No shops registered yet.</p>
                    </div>
                `;
                return;
            }

            document.getElementById('shopsList').innerHTML = shopsList.map((shop, idx) => `
                <div class="user-card expandable" onclick="toggleExpand('shop-${idx}')">
                    <div class="user-card-header">
                        <div class="user-info">
                            <span class="user-name">🏪 ${shop.businessName}</span>
                            <span class="user-phone">👤 ${shop.ownerName || ''}</span>
                            <span class="user-phone">📞 ${shop.phone}</span>
                            <span class="user-address">📍 ${shop.address?.street || ''} ${shop.address?.city || ''}</span>
                        </div>
                        <div class="user-meta">
                            <span class="user-status ${shop.isActive ? 'active' : 'inactive'}">${shop.isActive ? 'Active' : 'Inactive'}</span>
                            <span class="user-stat">🛒 ${shop.totalOrders || 0} orders</span>
                            <span class="user-stat">💰 ₦${(shop.totalSpent || 0).toLocaleString()} spent</span>
                            <span class="expand-toggle">▼</span>
                        </div>
                    </div>
                    <div class="user-card-body" id="shop-${idx}">
                        <div class="summary-grid">
                            <div class="summary-item">
                                <span class="summary-label">Total Orders</span>
                                <span class="summary-value">${shop.totalOrders || 0}</span>
                            </div>
                            <div class="summary-item">
                                <span class="summary-label">Total Spent</span>
                                <span class="summary-value">₦${(shop.totalSpent || 0).toLocaleString()}</span>
                            </div>
                        </div>

                        <p class="summary-heading">🛒 Recent Orders</p>
                        ${(shop.recentOrders && shop.recentOrders.length > 0) ? `
                            <div class="mini-list">
                                ${shop.recentOrders.map(o => `
                                    <div class="mini-item">
                                        <span><strong>${o.orderId}</strong> — ${o.distributorName}</span>
                                        <span><span class="mini-status mini-status-${o.status}">${(o.status || '').toUpperCase()}</span> ₦${(o.total || 0).toLocaleString()}</span>
                                    </div>
                                `).join('')}
                            </div>
                        ` : '<p class="mini-empty">No orders yet.</p>'}
                    </div>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('Error loading shops:', error);
        document.getElementById('shopsList').innerHTML = '<p style="text-align:center;color:var(--gray-500);">Failed to load shops</p>';
    }
}

// ============================================================
// LOAD ALL DISTRIBUTORS
// ============================================================
async function loadAllDistributors() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/distributors`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();

        if (data.success) {
            const distributorsList = data.distributors || [];
            document.getElementById('distributorsCount').textContent = distributorsList.length;

            if (distributorsList.length === 0) {
                document.getElementById('distributorsList').innerHTML = `
                    <div class="empty-state">
                        <p>📦</p>
                        <p>No distributors registered yet.</p>
                    </div>
                `;
                return;
            }

            document.getElementById('distributorsList').innerHTML = distributorsList.map((dist, idx) => `
               <div class="user-card expandable" onclick="toggleExpand('dist-${idx}')">
                   <div class="user-card-header">
                       <div class="user-info">
                           <span class="user-name">📦 ${dist.businessName}</span>
                           <span class="user-phone">👤 ${dist.ownerName || ''}</span>
                           <span class="user-phone">📞 ${dist.phone}</span>
                           <span class="user-address">📍 ${dist.address?.street || ''} ${dist.address?.city || ''}</span>
                       </div>
                       <div class="user-meta">
                           <span class="user-status ${dist.isActive ? 'active' : 'inactive'}">${dist.isActive ? 'Active' : 'Inactive'}</span>
                           <span class="user-stat">📦 ${dist.products?.length || 0} products</span>
                           <span class="user-stat">🛒 ${dist.totalOrders || 0} orders</span>
                           <span class="user-stat">💰 ₦${(dist.totalRevenue || 0).toLocaleString()}</span>
                           <span class="expand-toggle">▼</span>
                       </div>
                   </div>
                   <div class="user-card-body" id="dist-${idx}">
                       <div class="summary-grid">
                           <div class="summary-item">
                               <span class="summary-label">Total Orders</span>
                               <span class="summary-value">${dist.totalOrders || 0}</span>
                           </div>
                           <div class="summary-item">
                               <span class="summary-label">Total Revenue</span>
                               <span class="summary-value">₦${(dist.totalRevenue || 0).toLocaleString()}</span>
                           </div>
                           <div class="summary-item">
                               <span class="summary-label">Delivered</span>
                               <span class="summary-value">${dist.deliveredCount || 0}</span>
                           </div>
                           <div class="summary-item summary-warn">
                               <span class="summary-label">Unpaid</span>
                               <span class="summary-value">₦${(dist.unpaidAmount || 0).toLocaleString()}</span>
                           </div>
                       </div>

                       <p class="summary-heading">📦 Products (${dist.products?.length || 0})</p>
                       ${(dist.products && dist.products.length > 0) ? `
                           <div class="mini-list">
                               ${dist.products.slice(0, 5).map(p => `
                                   <div class="mini-item">
                                       <span>${p.name}</span>
                                       <span>₦${(p.price || 0).toLocaleString()} • ${p.stock || 0} in stock</span>
                                   </div>
                               `).join('')}
                               ${dist.products.length > 5 ? `<p class="mini-more">...and ${dist.products.length - 5} more</p>` : ''}
                           </div>
                       ` : '<p class="mini-empty">No products yet.</p>'}

                       <p class="summary-heading">🛒 Recent Orders</p>
                       ${(dist.recentOrders && dist.recentOrders.length > 0) ? `
                           <div class="mini-list">
                               ${dist.recentOrders.map(o => `
                                   <div class="mini-item">
                                       <span><strong>${o.orderId}</strong> — ${o.shopName}</span>
                                       <span><span class="mini-status mini-status-${o.status}">${(o.status || '').toUpperCase()}</span> ₦${(o.total || 0).toLocaleString()}</span>
                                   </div>
                               `).join('')}
                           </div>
                       ` : '<p class="mini-empty">No orders yet.</p>'}
                   </div>
               </div>
           `).join('');
        }
    } catch (error) {
        console.error('Error loading distributors:', error);
        document.getElementById('distributorsList').innerHTML = '<p style="text-align:center;color:var(--gray-500);">Failed to load distributors</p>';
    }
}

// ============================================================
// LOAD ALL RIDERS
// ============================================================
async function loadAllRiders() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/riders`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();

        if (data.success) {
            const ridersList = data.riders || [];
            document.getElementById('ridersCount').textContent = ridersList.length;

            if (ridersList.length === 0) {
                document.getElementById('ridersList').innerHTML = `
                    <div class="empty-state">
                        <p>🏍️</p>
                        <p>No riders registered yet.</p>
                    </div>
                `;
                return;
            }

            document.getElementById('ridersList').innerHTML = ridersList.map((rider, idx) => `
                <div class="user-card expandable" onclick="toggleExpand('rider-${idx}')">
                    <div class="user-card-header">
                        <div class="user-info">
                            <span class="user-name">🏍️ ${rider.fullName}</span>
                            <span class="user-phone">📞 ${rider.phone}</span>
                            <span class="user-address">🚗 ${rider.vehicleType || 'motorcycle'} ${rider.vehiclePlate ? '• ' + rider.vehiclePlate : ''}</span>
                            <span class="user-address">📍 ${rider.currentLocation?.city || 'Unknown'}</span>
                        </div>
                        <div class="user-meta">
                            <span class="user-status ${rider.isActive ? 'active' : 'inactive'}">${rider.status || 'available'}</span>
                            <span class="user-stat">📦 ${rider.totalDeliveries || 0} deliveries</span>
                            <span class="user-stat">💰 ₦${(rider.totalEarned || 0).toLocaleString()}</span>
                            <span class="expand-toggle">▼</span>
                        </div>
                    </div>
                    <div class="user-card-body" id="rider-${idx}">
                        <div class="summary-grid">
                            <div class="summary-item">
                                <span class="summary-label">Completed</span>
                                <span class="summary-value">${rider.completedCount || 0}</span>
                            </div>
                            <div class="summary-item">
                                <span class="summary-label">Active Now</span>
                                <span class="summary-value">${(rider.activeDeliveries || []).length}</span>
                            </div>
                            <div class="summary-item">
                                <span class="summary-label">Total Earned</span>
                                <span class="summary-value">₦${(rider.totalEarned || 0).toLocaleString()}</span>
                            </div>
                        </div>

                        <p class="summary-heading">🚚 Active Deliveries</p>
                        ${(rider.activeDeliveries && rider.activeDeliveries.length > 0) ? `
                            <div class="mini-list">
                                ${rider.activeDeliveries.map(o => `
                                    <div class="mini-item">
                                        <span><strong>${o.orderId}</strong></span>
                                        <span><span class="mini-status mini-status-${o.status}">${(o.status || '').toUpperCase()}</span> ₦${(o.total || 0).toLocaleString()}</span>
                                    </div>
                                `).join('')}
                            </div>
                        ` : '<p class="mini-empty">No active deliveries.</p>'}

                        <p class="summary-heading">📦 Recent Orders</p>
                        ${(rider.recentOrders && rider.recentOrders.length > 0) ? `
                            <div class="mini-list">
                                ${rider.recentOrders.map(o => `
                                    <div class="mini-item">
                                        <span><strong>${o.orderId}</strong></span>
                                        <span><span class="mini-status mini-status-${o.status}">${(o.status || '').toUpperCase()}</span> ₦${(o.total || 0).toLocaleString()}</span>
                                    </div>
                                `).join('')}
                            </div>
                        ` : '<p class="mini-empty">No orders yet.</p>'}
                    </div>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('Error loading riders:', error);
        document.getElementById('ridersList').innerHTML = '<p style="text-align:center;color:var(--gray-500);">Failed to load riders</p>';
    }
}

// ============================================================
// LOAD ALL ORDERS
// ============================================================
async function loadAllOrders() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/orders`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();

        if (data.success) {
            const ordersList = data.orders || [];
            document.getElementById('ordersCount').textContent = ordersList.length;

            if (ordersList.length === 0) {
                document.getElementById('ordersList').innerHTML = `
                    <div class="empty-state">
                        <p>📦</p>
                        <p>No orders yet.</p>
                    </div>
                `;
                return;
            }

            document.getElementById('ordersList').innerHTML = ordersList.slice(0, 20).map(order => `
                <div class="user-card">
                    <div class="user-info">
                        <span class="user-name">#${order._id.slice(-6).toUpperCase()}</span>
                        <span class="user-phone">🏪 ${order.shopId?.businessName || 'Unknown Shop'}</span>
                        <span class="user-phone">📦 ${order.distributorId?.businessName || 'Unknown Distributor'}</span>
                        <span class="user-address">📅 ${new Date(order.createdAt).toLocaleDateString()}</span>
                    </div>
                    <div class="user-meta">
                        <span class="user-status ${order.status === 'delivered' ? 'active' : 'inactive'}">${order.status?.toUpperCase()}</span>
                        <span class="user-stat">💰 ₦${order.total?.toLocaleString() || 0}</span>
                    </div>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('Error loading orders:', error);
        document.getElementById('ordersList').innerHTML = '<p style="text-align:center;color:var(--gray-500);">Failed to load orders</p>';
    }
}

// ============================================================
// LOAD PRODUCT REQUESTS
// ============================================================
async function loadProductRequests() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/product-requests`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();

        if (data.success) {
            const requests = data.requests || [];
            const countEl = document.getElementById('requestsCount');
            if (countEl) countEl.textContent = requests.length;

            // Update badge
            const pendingCount = requests.filter(r => r.status === 'pending').length;
            const badge = document.getElementById('requestsBadge');
            if (badge) {
                if (pendingCount > 0) {
                    badge.textContent = pendingCount;
                    badge.style.display = 'inline';
                } else {
                    badge.style.display = 'none';
                }
            }

            const listEl = document.getElementById('requestsList');
            if (!listEl) return;

            if (requests.length === 0) {
                listEl.innerHTML = `
                    <div class="empty-state">
                        <p>📝</p>
                        <p>No product requests yet.</p>
                    </div>
                `;
                return;
            }

            listEl.innerHTML = requests.map(req => {
                const statusColors = {
                    pending: { bg: '#FFF3E0', color: '#E65100' },
                    sourcing: { bg: '#E3F2FD', color: '#0D47A1' },
                    found: { bg: '#E8F5E9', color: '#1B5E20' },
                    unavailable: { bg: '#FFEBEE', color: '#C62828' },
                    fulfilled: { bg: '#E8F5E9', color: '#1B5E20' }
                };
                const statusStyle = statusColors[req.status] || statusColors.pending;

                return `
                    <div class="user-card">
                        <div class="user-info">
                            <span class="user-name">📦 ${req.productName}</span>
                            <span class="user-phone">🏪 ${req.shopId?.businessName || 'Unknown Shop'}</span>
                            <span class="user-phone">📞 ${req.shopId?.phone || 'No phone'}</span>
                            <span class="user-address">📅 ${new Date(req.createdAt).toLocaleDateString()}</span>
                            ${req.notes ? `<span class="user-address">📝 ${req.notes}</span>` : ''}
                        </div>
                        <div class="user-meta">
                            <span class="user-status" style="background: ${statusStyle.bg}; color: ${statusStyle.color};">
                                ${req.status.toUpperCase()}
                            </span>
                            <span class="user-stat">${req.quantity} ${req.unit}(s)</span>
                            <div style="display: flex; gap: 4px; margin-top: 8px;">
                                <button class="btn btn-outline" onclick="updateRequestStatus('${req._id}', 'sourcing')" style="padding: 4px 10px; font-size: 11px;">🔍 Sourcing</button>
                                <button class="btn btn-outline" onclick="updateRequestStatus('${req._id}', 'found')" style="padding: 4px 10px; font-size: 11px; background: #4DBE18; color: white;">✅ Found</button>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
        }
    } catch (error) {
        console.error('Error loading product requests:', error);
    }
}

// ============================================================
// UPDATE REQUEST STATUS
// ============================================================
async function updateRequestStatus(requestId, status) {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/product-requests/${requestId}/status`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status })
        });

        const data = await response.json();
        if (data.success) {
            showToast(`✅ Status updated to ${status}`);
            loadProductRequests();
        } else {
            showToast('❌ Failed: ' + (data.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('Update status error:', error);
        showToast('❌ Failed to update status');
    }
}

// ============================================================
// EARNINGS
// ============================================================
async function loadEarnings() {
    const container = document.getElementById('earningsList');
    const range = document.getElementById('earningsRange')?.value || 'all';
    if (!container) return;

    container.innerHTML = '<div class="loading">Loading earnings...</div>';

    try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_URL}/admin/earnings?range=${range}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.status === 403) {
            container.innerHTML = '<div class="empty-state"><p>🔒</p><p>Admin access required.</p></div>';
            return;
        }
        if (res.status === 401) {
            container.innerHTML = '<div class="empty-state"><p>🔒</p><p>Please log in again.</p></div>';
            return;
        }

        const data = await res.json();
        if (!data.success) {
            container.innerHTML = `<div class="empty-state"><p>❌</p><p>${data.error || 'Failed to load'}</p></div>`;
            return;
        }

        renderEarningsSummary(data.summary);
        renderEarningsTable(data.breakdown);
    } catch (e) {
        console.error('Earnings error:', e);
        container.innerHTML = '<div class="empty-state"><p>❌</p><p>Network error</p></div>';
    }
}

function renderEarningsSummary(s) {
    document.getElementById('earningsCashIn').textContent = '₦' + (s.totalIncomingDelivered || 0).toLocaleString();
    document.getElementById('earningsCashOut').textContent = '₦' + (s.totalPaidToDistributors || 0).toLocaleString();
    document.getElementById('earningsOwed').textContent = '₦' + (s.unpaidToDistributors || 0).toLocaleString();
    document.getElementById('earningsNet').textContent = '₦' + (s.netPosition || 0).toLocaleString();
}

function renderEarningsTable(rows) {
    const container = document.getElementById('earningsList');
    if (!rows || rows.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>📭</p><p>No orders found.</p></div>';
        return;
    }

    const html = rows.map(o => `
        <tr>
            <td><strong>${o.orderId}</strong></td>
            <td>${o.shopName}</td>
            <td>${o.distributorName}</td>
            <td><span class="order-status-badge ${o.status}">${(o.status || '').toUpperCase()}</span></td>
            <td>₦${(o.total || 0).toLocaleString()}</td>
            <td>${o.paidToDistributor
                ? `<span class="btn-paid">✅ Paid</span>`
                : `<button class="btn-mark-paid" onclick="markPaid('${o._id}')">💸 Mark as Paid</button>`
            }</td>
        </tr>
    `).join('');

    container.innerHTML = `
        <table class="earnings-table">
            <thead>
                <tr>
                    <th>Order</th>
                    <th>Shop</th>
                    <th>Distributor</th>
                    <th>Status</th>
                    <th>Total</th>
                    <th>Payment</th>
                </tr>
            </thead>
            <tbody>${html}</tbody>
        </table>
    `;
}

async function markPaid(orderId) {
    const amount = prompt('Amount paid to distributor (₦):');
    if (amount === null) return;

    const note = prompt('Note (optional):', '') || '';

    try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_URL}/orders/${orderId}/mark-paid-to-distributor`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                amount: parseFloat(amount) || 0,
                note
            })
        });

        const data = await res.json();
        if (data.success) {
            showToast('✅ Marked as paid');
            loadEarnings();
        } else {
            showToast('❌ ' + (data.error || 'Failed'));
        }
    } catch (e) {
        console.error('Mark-paid error:', e);
        showToast('❌ Network error');
    }
}

// ============================================================
// NOTIFICATIONS
// ============================================================
let notifPollTimer = null;

async function loadUnreadCount() {
    try {
        const token = localStorage.getItem('token');
        if (!token) return;
        const res = await fetch(`${API_URL}/notifications/unread-count`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success) updateNotifBadge(data.unreadCount || 0);
    } catch (e) { /* silent */ }
}

function updateNotifBadge(count) {
    const badge = document.getElementById('notifBadge');
    if (!badge) return;
    if (count > 0) {
        badge.textContent = count > 99 ? '99+' : count;
        badge.style.display = 'inline';
    } else {
        badge.style.display = 'none';
    }
}

async function loadNotifications() {
    const container = document.getElementById('notificationsList');
    if (!container) return;
    container.innerHTML = '<div class="loading">Loading notifications...</div>';

    try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_URL}/notifications?limit=50`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (!data.success) {
            container.innerHTML = '<div class="empty-state">❌ Failed to load</div>';
            return;
        }

        updateNotifBadge(data.unreadCount || 0);

        const label = document.getElementById('notifUnreadLabel');
        if (label) {
            label.textContent = data.unreadCount > 0 ? `${data.unreadCount} unread` : 'All caught up';
        }
        const markAllBtn = document.getElementById('markAllBtn');
        if (markAllBtn) markAllBtn.style.display = data.unreadCount > 0 ? 'inline-block' : 'none';

        if (!data.notifications || data.notifications.length === 0) {
            container.innerHTML = '<div class="empty-state" style="text-align:center;padding:60px 20px;"><p style="font-size:48px;">🔔</p><p>No notifications yet.</p></div>';
            return;
        }

        container.innerHTML = data.notifications.map(n => `
            <div class="notif-row ${n.read ? '' : 'unread'}" onclick="tapNotification('${n._id}', ${n.read})">
                <div class="notif-icon-wrap">${notifIcon(n.type)}</div>
                <div class="notif-content">
                    <div class="notif-title">${n.title}</div>
                    ${n.body ? `<div class="notif-body">${n.body}</div>` : ''}
                    <div class="notif-time">${timeAgo(n.createdAt)}</div>
                </div>
                ${n.read ? '' : '<div class="notif-dot"></div>'}
            </div>
        `).join('');
    } catch (e) {
        console.error(e);
        container.innerHTML = '<div class="empty-state">❌ Network error</div>';
    }
}

async function tapNotification(id, isRead) {
    if (!isRead) {
        try {
            const token = localStorage.getItem('token');
            await fetch(`${API_URL}/notifications/${id}/read`, {
                method: 'PATCH',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            await loadNotifications();
            await loadUnreadCount();
        } catch (e) { console.error(e); }
    }
}

async function markAllNotificationsRead() {
    try {
        const token = localStorage.getItem('token');
        await fetch(`${API_URL}/notifications/read-all`, {
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        await loadNotifications();
        await loadUnreadCount();
        showToast('✅ All marked as read');
    } catch (e) {
        showToast('❌ Failed');
    }
}

function notifIcon(type) {
    const map = {
        order_placed: '📦',
        new_order: '🆕',
        order_confirmed: '✅',
        rider_assigned: '🏍️',
        delivery_assigned: '🚚',
        order_delivered: '✅',
        order_cancelled: '❌',
        chat_message: '💬',
        product_request: '📝',
    };
    return map[type] || '🔔';
}

function timeAgo(dateStr) {
    const seconds = Math.floor((new Date() - new Date(dateStr)) / 1000);
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return Math.floor(seconds / 60) + 'm ago';
    if (seconds < 86400) return Math.floor(seconds / 3600) + 'h ago';
    if (seconds < 604800) return Math.floor(seconds / 86400) + 'd ago';
    return new Date(dateStr).toLocaleDateString();
}

// Poll unread count every 30s
function startNotifPolling() {
    if (notifPollTimer) clearInterval(notifPollTimer);
    loadUnreadCount();
    notifPollTimer = setInterval(loadUnreadCount, 30000);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startNotifPolling);
} else {
    startNotifPolling();
}

// ============================================================
// MANAGE DISTRIBUTOR PRODUCTS
// ============================================================
let currentDistributorId = null;

async function loadDistributorDropdown() {
    const select = document.getElementById('distProductsSelect');
    if (!select) return;

    try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_URL}/distributors`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        if (!data.success) return;

        select.innerHTML = '<option value="">-- Choose a distributor --</option>';
        data.distributors.forEach(d => {
            const opt = document.createElement('option');
            opt.value = d._id;
            opt.textContent = `${d.businessName} (${d.phone})`;
            select.appendChild(opt);
        });
    } catch (e) {
        console.error('Load distributors error:', e);
    }
}

async function loadDistributorProducts() {
    const select = document.getElementById('distProductsSelect');
    const listWrap = document.getElementById('distProductsList');
    const formWrap = document.getElementById('addProductFormWrap');

    const id = select.value;
    currentDistributorId = id;

    if (!id) {
        listWrap.innerHTML = '<p style="color: var(--gray-500); font-size: 14px;">Select a distributor to see products.</p>';
        formWrap.style.display = 'none';
        return;
    }

    formWrap.style.display = 'block';
    listWrap.innerHTML = '<p style="color: var(--gray-500);">Loading products...</p>';

    try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_URL}/admin/distributors/${id}/products`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        if (!data.success) {
            listWrap.innerHTML = `<p style="color: var(--danger);">${data.error || 'Failed to load'}</p>`;
            return;
        }

        renderDistributorProducts(data.products || []);
    } catch (e) {
        console.error('Load products error:', e);
        listWrap.innerHTML = '<p style="color: var(--danger);">Network error</p>';
    }
}

function renderDistributorProducts(products) {
    const listWrap = document.getElementById('distProductsList');

    if (!products || products.length === 0) {
        listWrap.innerHTML = '<p style="color: var(--gray-500); font-size: 14px;">No products yet. Add one above.</p>';
        return;
    }

    const rows = products.map((p, i) => `
        <tr>
            <td><strong>${p.name}</strong><br><span style="font-size: 12px; color: var(--gray-500);">${p.category || ''} ${p.size ? '• ' + p.size : ''}</span></td>
            <td>₦${(p.price || 0).toLocaleString()}</td>
            <td>${p.unit || ''}</td>
            <td>${p.stock || 0}</td>
            <td style="text-align: right;">
                <button class="btn btn-outline" style="padding: 6px 10px; font-size: 12px; margin-right: 4px;"
                    onclick="adminEditProduct(${i})">✏️ Edit</button>
                <button class="btn" style="background: #E17055; color: white; padding: 6px 10px; font-size: 12px;"
                    onclick="adminDeleteProduct(${i})">🗑️</button>
            </td>
        </tr>
    `).join('');

    listWrap.innerHTML = `
        <table style="width: 100%; border-collapse: collapse;">
            <thead>
                <tr style="border-bottom: 2px solid var(--gray-200); text-align: left;">
                    <th style="padding: 8px;">Product</th>
                    <th style="padding: 8px;">Price</th>
                    <th style="padding: 8px;">Unit</th>
                    <th style="padding: 8px;">Stock</th>
                    <th style="padding: 8px;"></th>
                </tr>
            </thead>
            <tbody>
                ${rows}
            </tbody>
        </table>
    `;
}

async function adminAddProduct() {
    if (!currentDistributorId) {
        showToast('⚠️ Select a distributor first');
        return;
    }

    const name = document.getElementById('apName').value.trim();
    const category = document.getElementById('apCategory').value;
    const price = document.getElementById('apPrice').value;
    const unit = document.getElementById('apUnit').value;
    const size = document.getElementById('apSize').value.trim();
    const stock = document.getElementById('apStock').value;

    if (!name || !price || stock === '') {
        showToast('⚠️ Fill in name, price, and stock');
        return;
    }

    try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_URL}/admin/distributors/${currentDistributorId}/products`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name, category, price, unit, size, stock })
        });
        const data = await res.json();

        if (data.success) {
            showToast('✅ Product added');
            // clear form
            document.getElementById('apName').value = '';
            document.getElementById('apPrice').value = '';
            document.getElementById('apSize').value = '';
            document.getElementById('apStock').value = '';
            renderDistributorProducts(data.products || []);
        } else {
            showToast('❌ ' + (data.error || 'Failed'));
        }
    } catch (e) {
        console.error(e);
        showToast('❌ Network error');
    }
}

async function adminDeleteProduct(index) {
    if (!currentDistributorId) return;
    if (!confirm('Delete this product?')) return;

    try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_URL}/admin/distributors/${currentDistributorId}/products/${index}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success) {
            showToast('✅ Deleted');
            renderDistributorProducts(data.products || []);
        } else {
            showToast('❌ ' + (data.error || 'Failed'));
        }
    } catch (e) {
        console.error(e);
        showToast('❌ Network error');
    }
}

async function adminEditProduct(index) {
    if (!currentDistributorId) return;

    const newName = prompt('Product name:');
    if (newName === null) return;

    const newPrice = prompt('Price (₦):');
    if (newPrice === null) return;

    const newStock = prompt('Stock:');
    if (newStock === null) return;

    try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_URL}/admin/distributors/${currentDistributorId}/products/${index}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name: newName, price: newPrice, stock: newStock })
        });
        const data = await res.json();
        if (data.success) {
            showToast('✅ Updated');
            renderDistributorProducts(data.products || []);
        } else {
            showToast('❌ ' + (data.error || 'Failed'));
        }
    } catch (e) {
        console.error(e);
        showToast('❌ Network error');
    }
}

// ============================================================
// EXPAND/COLLAPSE CARDS
// ============================================================
function toggleExpand(id) {
    const body = document.getElementById(id);
    if (!body) return;
    const card = body.closest('.user-card');
    const toggle = card?.querySelector('.expand-toggle');
    const isOpen = body.classList.contains('open');

    if (isOpen) {
        body.classList.remove('open');
        if (toggle) toggle.textContent = '▼';
        card.classList.remove('expanded');
    } else {
        body.classList.add('open');
        if (toggle) toggle.textContent = '▲';
        card.classList.add('expanded');
    }
}

// ============================================================
// INITIAL LOAD
// ============================================================
if (checkAuth()) {
    console.log('🚀 Admin Dashboard loading...');
    fetchData();
    
    // Auto-refresh every 30 seconds
    setInterval(fetchData, 30000);
}