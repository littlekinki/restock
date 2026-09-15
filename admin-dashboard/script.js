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
    const sections = ['settingsSection', 'shopsSection', 'distributorsSection', 'ridersSection', 'ordersSection', 'requestsSection'];
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

            document.getElementById('shopsList').innerHTML = shopsList.map(shop => `
                <div class="user-card">
                    <div class="user-info">
                        <span class="user-name">🏪 ${shop.businessName}</span>
                        <span class="user-phone">👤 ${shop.ownerName}</span>
                        <span class="user-phone">📞 ${shop.phone}</span>
                        <span class="user-address">📍 ${shop.address?.street || ''} ${shop.address?.city || ''}</span>
                    </div>
                    <div class="user-meta">
                        <span class="user-status ${shop.isActive ? 'active' : 'inactive'}">${shop.isActive ? 'Active' : 'Inactive'}</span>
                        <span class="user-stat">📦 ${shop.totalOrders || 0} orders</span>
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

            document.getElementById('distributorsList').innerHTML = distributorsList.map(dist => `
                <div class="user-card">
                    <div class="user-info">
                        <span class="user-name">📦 ${dist.businessName}</span>
                        <span class="user-phone">👤 ${dist.ownerName}</span>
                        <span class="user-phone">📞 ${dist.phone}</span>
                        <span class="user-address">📍 ${dist.address?.street || ''} ${dist.address?.city || ''}</span>
                    </div>
                    <div class="user-meta">
                        <span class="user-status ${dist.isActive ? 'active' : 'inactive'}">${dist.isActive ? 'Active' : 'Inactive'}</span>
                        <span class="user-stat">📦 ${dist.products?.length || 0} products</span>
                        <span class="user-stat">🛒 ${dist.totalOrders || 0} orders</span>
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

            document.getElementById('ridersList').innerHTML = ridersList.map(rider => `
                <div class="user-card">
                    <div class="user-info">
                        <span class="user-name">🏍️ ${rider.fullName}</span>
                        <span class="user-phone">📞 ${rider.phone}</span>
                        <span class="user-address">🚗 ${rider.vehicleType || 'motorcycle'} ${rider.vehiclePlate ? '• ' + rider.vehiclePlate : ''}</span>
                        <span class="user-address">📍 ${rider.currentLocation?.city || 'Unknown'}</span>
                    </div>
                    <div class="user-meta">
                        <span class="user-status ${rider.isActive ? 'active' : 'inactive'}">${rider.status || 'available'}</span>
                        <span class="user-stat">📦 ${rider.totalDeliveries || 0} deliveries</span>
                        <span class="user-stat">💰 ₦${(rider.earnings || 0).toLocaleString()}</span>
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
// INITIAL LOAD
// ============================================================
if (checkAuth()) {
    console.log('🚀 Admin Dashboard loading...');
    fetchData();
    
    // Auto-refresh every 30 seconds
    setInterval(fetchData, 30000);
}