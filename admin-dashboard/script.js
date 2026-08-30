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

function getAuthHeaders() {
    const token = localStorage.getItem('token');
    return {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    };
}

// ============================================================
// FETCH DATA
// ============================================================
async function fetchData() {
    try {
        const token = localStorage.getItem('token');
        
        // Fetch all data in parallel
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
    // Group orders by date
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
    
    // Orders Chart
    const ctx1 = document.getElementById('ordersChart').getContext('2d');
    if (ordersChart) ordersChart.destroy();
    ordersChart = new Chart(ctx1, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Orders',
                data: orderCounts,
                backgroundColor: '#6C5CE7',
                borderColor: '#5A4BD1',
                borderWidth: 1,
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { stepSize: 1 }
                }
            }
        }
    });
    
    // Revenue Chart
    const ctx2 = document.getElementById('revenueChart').getContext('2d');
    if (revenueChart) revenueChart.destroy();
    revenueChart = new Chart(ctx2, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Revenue (₦)',
                data: revenueCounts,
                backgroundColor: 'rgba(0, 184, 148, 0.1)',
                borderColor: '#00B894',
                borderWidth: 3,
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return '₦' + value.toLocaleString();
                        }
                    }
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
    document.getElementById('lastUpdated').textContent = `Last updated: ${now.toLocaleTimeString()}`;
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
// INITIAL LOAD
// ============================================================
if (checkAuth()) {
    console.log('🚀 Admin Dashboard loading...');
    fetchData();
    
    // Auto-refresh every 30 seconds
    setInterval(fetchData, 30000);
}