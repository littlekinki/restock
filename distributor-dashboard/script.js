// ============================================================
// API Configuration
// ============================================================
const API_URL = 'https://restock-backend-zkrx.onrender.com/api';
let currentOrders = [];
let currentFilter = 'all';
let selectedOrderId = null;
let allDistributors = [];
let selectedDistributorId = 'all';

// ============================================================
// FETCH ORDERS 
// ============================================================
async function fetchOrders() {
    try {
        const token = localStorage.getItem('token');
        const user = JSON.parse(localStorage.getItem('user') || 'null');

        if (!token || !user) {
            console.log('⚠️ No user logged in. Redirecting...');
            window.location.href = '../landing-page/index.html';
            return;
        }

        const response = await fetch(`${API_URL}/orders`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            // ... rest of your code
        } else if (data.error === 'Invalid or expired token') {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '../landing-page/index.html';
        }
    } catch (error) {
        console.error('Error fetching orders:', error);
        showError('Could not connect to server.');
    }
}

// ============================================================
// RENDER ORDERS
// ============================================================
function renderOrders(orders) {
    const orderList = document.getElementById('orderList');
    
    let filteredOrders = orders;
    if (currentFilter !== 'all') {
        filteredOrders = orders.filter(order => order.status === currentFilter);
    }
    
    if (filteredOrders.length === 0) {
        orderList.innerHTML = `
            <div class="empty-state">
                <p>📭 No orders yet</p>
                <p style="color: var(--gray-500); font-size: 14px;">
                    ${currentFilter === 'all' ? 'Orders will appear here when shops place them.' : `No ${currentFilter} orders found.`}
                </p>
            </div>
        `;
        return;
    }

    orderList.innerHTML = filteredOrders.map(order => {
        const orderId = order._id || '';
        const statusClass = order.status || 'pending';
        const shopName = order.shopId?.businessName || 'Unknown Shop';
        const itemsSummary = order.items?.map(item => 
            `${item.productName} x${item.quantity}`
        ).join(', ') || 'No items';
        const total = order.total || 0;

        return `
            <div class="order-card" onclick="openOrderDetail('${orderId}')">
                <div class="order-info">
                    <div class="order-shop">🏪 ${shopName}</div>
                    <div class="order-id">#${orderId.slice(-6).toUpperCase()}</div>
                    <div class="order-items">${itemsSummary}</div>
                </div>
                <div class="order-meta">
                    <div class="order-total">₦${total.toLocaleString()}</div>
                    <span class="order-status ${statusClass}">${statusClass.replace('_', ' ').toUpperCase()}</span>
                </div>
            </div>
        `;
    }).join('');
}

// ============================================================
// UPDATE STATS
// ============================================================
function updateStats(orders) {
    const today = new Date().toDateString();
    
    const todayOrders = orders.filter(order => {
        const orderDate = new Date(order.createdAt).toDateString();
        return orderDate === today;
    });
    
    const pendingOrders = orders.filter(order => order.status === 'pending');
    const deliveredOrders = orders.filter(order => order.status === 'delivered');
    
    const todayRevenue = deliveredOrders
        .filter(order => new Date(order.createdAt).toDateString() === today)
        .reduce((sum, order) => sum + (order.total || 0), 0);
    
    const uniqueShops = new Set(orders.map(order => order.shopId?._id).filter(Boolean));
    
    document.getElementById('todayOrders').textContent = todayOrders.length;
    document.getElementById('pendingOrders').textContent = pendingOrders.length;
    document.getElementById('todayRevenue').textContent = `₦${todayRevenue.toLocaleString()}`;
    document.getElementById('activeShops').textContent = uniqueShops.size;
}

// ============================================================
// UPDATE BADGE
// ============================================================
function updateBadge(orders) {
    const pendingCount = orders.filter(order => order.status === 'pending').length;
    const badge = document.getElementById('pendingBadge');
    if (pendingCount > 0) {
        badge.textContent = pendingCount;
        badge.style.display = 'inline';
    } else {
        badge.style.display = 'none';
    }
}

// ============================================================
// FILTER ORDERS
// ============================================================
function filterOrders(filter) {
    currentFilter = filter;
    
    document.querySelectorAll('.filter-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.filter === filter);
    });
    
    renderOrders(currentOrders);
}

// ============================================================
// OPEN ORDER DETAIL
// ============================================================
async function openOrderDetail(orderId) {
    console.log('🔍 Opening order detail for:', orderId);
    
    if (!orderId || orderId === 'null' || orderId === 'undefined') {
        showError('Invalid order ID');
        return;
    }
    
    selectedOrderId = orderId;
    console.log('✅ selectedOrderId set to:', selectedOrderId);
    
    const modal = document.getElementById('orderModal');
    
    try {
        const response = await fetch(`${API_URL}/orders/${orderId}`);
        const data = await response.json();
        
        if (!data.success) {
            showError(data.error || 'Failed to load order details');
            return;
        }
        
        const order = data.order;
        const hasPickup = order.pickupAddress && order.pickupAddress.distributorName;
        
        const detailHtml = `
            <div style="margin-bottom: 20px;">
                <h3 style="font-size: 18px; margin-bottom: 4px;">🏪 ${order.shopId?.businessName || 'Unknown Shop'}</h3>
                <p style="color: var(--gray-500); font-size: 14px;">Order #${order._id.slice(-6).toUpperCase()}</p>
                <p style="color: var(--gray-600); font-size: 14px;">📍 ${order.deliveryAddress?.address || ''} ${order.deliveryAddress?.city || ''}</p>
                <p style="color: var(--gray-600); font-size: 14px;">📞 ${order.shopId?.phone || 'No phone'}</p>
            </div>
            
            ${hasPickup ? `
            <div style="margin-bottom: 16px; background: #FFF3E0; padding: 12px 16px; border-radius: var(--radius); border-left: 4px solid #E65100;">
                <p style="font-weight: 600; font-size: 13px; color: #E65100;">📦 Pickup from Distributor</p>
                <p style="font-weight: 600; font-size: 14px;">${order.pickupAddress.distributorName}</p>
                <p style="color: var(--gray-600); font-size: 14px;">📍 ${order.pickupAddress.address || ''} ${order.pickupAddress.city || ''}</p>
                <p style="color: var(--gray-600); font-size: 14px;">📞 ${order.pickupAddress.phone || 'No phone'}</p>
            </div>
            ` : ''}
            
            <div style="margin-bottom: 16px;">
                <p style="font-weight: 600; font-size: 14px; margin-bottom: 8px;">Items:</p>
                ${order.items?.map(item => `
                    <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--gray-100);">
                        <span>${item.productName} x${item.quantity}</span>
                        <span>₦${item.total?.toLocaleString() || 0}</span>
                    </div>
                `).join('') || '<p style="color: var(--gray-500);">No items</p>'}
            </div>
            
            <div style="background: var(--gray-50); padding: 16px; border-radius: var(--radius); margin-bottom: 16px;">
                <div style="display: flex; justify-content: space-between; font-weight: 700; font-size: 18px; border-top: 1px solid var(--gray-300); padding-top: 8px;">
                    <span>Total</span>
                    <span>₦${order.total?.toLocaleString() || 0}</span>
                </div>
            </div>
            
            <div style="margin-bottom: 16px;">
                <p style="font-weight: 600; font-size: 14px; margin-bottom: 8px;">Status:</p>
                <span class="order-status ${order.status}">${order.status?.replace('_', ' ').toUpperCase() || 'Pending'}</span>
            </div>
            
            <div>
                <p style="font-weight: 600; font-size: 14px; margin-bottom: 8px;">Tracking:</p>
                ${order.trackingUpdates?.map(update => `
                    <div style="display: flex; gap: 12px; padding: 4px 0; font-size: 14px;">
                        <span style="color: var(--gray-500);">${new Date(update.timestamp).toLocaleTimeString()}</span>
                        <span>${update.status?.replace('_', ' ').toUpperCase()}</span>
                        ${update.note ? `<span style="color: var(--gray-600);">— ${update.note}</span>` : ''}
                    </div>
                `).join('') || '<p style="color: var(--gray-500);">No tracking updates</p>'}
            </div>
        `;
        
        document.getElementById('orderDetail').innerHTML = detailHtml;
        
        const confirmBtn = document.getElementById('confirmBtn');
        if (order.status === 'pending' || order.status === 'confirmed') {
            confirmBtn.style.display = 'inline-block';
            confirmBtn.setAttribute('data-order-id', orderId);
            
            if (order.status === 'pending') {
                confirmBtn.textContent = '✅ Confirm & Prepare';
                confirmBtn.className = 'btn btn-primary';
                confirmBtn.onclick = function() {
                    console.log('🟢 Confirm button clicked for order:', this.getAttribute('data-order-id'));
                    confirmOrder();
                };
            } else {
                confirmBtn.textContent = '📍 Assign Nearby Rider';
                confirmBtn.className = 'btn btn-success';
                confirmBtn.onclick = function() {
                    console.log('🟢 Assign rider button clicked for order:', this.getAttribute('data-order-id'));
                    confirmOrder();
                };
            }
        } else {
            confirmBtn.style.display = 'none';
        }
        
        modal.classList.add('active');
        
    } catch (error) {
        console.error('Error fetching order details:', error);
        showError('Could not load order details');
    }
}

// ============================================================
// CONFIRM ORDER 
// ============================================================
async function confirmOrder() {
    const confirmBtn = document.getElementById('confirmBtn');
    const orderId = confirmBtn.getAttribute('data-order-id');
    
    console.log('🔍 Confirm Order called');
    console.log('📦 Order ID from button:', orderId);
    
    const idToUse = orderId || selectedOrderId;
    
    if (!idToUse) {
        console.error('❌ No order ID available');
        showError('No order selected');
        return;
    }
    
    try {
        console.log('📡 Fetching order details for:', idToUse);
        const response = await fetch(`${API_URL}/orders/${idToUse}`);
        const data = await response.json();
        
        if (!data.success) {
            showError(data.error || 'Failed to get order details');
            return;
        }
        
        const order = data.order;
        console.log('📦 Order status:', order.status);
        
        // If pending → confirm
        if (order.status === 'pending') {
            console.log('✅ Confirming order...');
            const updateResponse = await fetch(`${API_URL}/orders/${idToUse}/status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'confirmed', note: 'Order confirmed by distributor' })
            });
            
            const updateData = await updateResponse.json();
            console.log('📡 Update response:', updateData);
            
            if (updateData.success) {
                showToast('✅ Order confirmed! Now assign a rider.');
                closeModal();
                setTimeout(() => openOrderDetail(idToUse), 500);
                fetchOrders();
            } else {
                showError('Failed to confirm order: ' + (updateData.error || 'Unknown error'));
            }
            return;
        }
        
        // If confirmed → show rider selection
        if (order.status === 'confirmed') {
            console.log('📍 Getting all riders...');
            
            // ✅ Fetch ALL riders (not just nearby or available)
            const allRidersResponse = await fetch(`${API_URL}/riders`);
            const allRidersData = await allRidersResponse.json();
            
            if (!allRidersData.success || allRidersData.riders.length === 0) {
                showToast('⚠️ No riders in the system. Please add a rider first.');
                return;
            }
            
            // ✅ Show ALL riders (even busy ones) for batch delivery
            console.log(`✅ Found ${allRidersData.riders.length} rider(s) in the system`);
            
            // Add a note for busy riders that they can still get more orders
            const ridersWithNote = allRidersData.riders.map(rider => ({
                ...rider,
                displayStatus: rider.status === 'available' ? '🟢 Available' : '🟡 Has deliveries (can take more)'
            }));
            
            showNearbyRiders(idToUse, ridersWithNote);
            return;
        }
        
        showToast('Order already in progress');
        
    } catch (error) {
        console.error('❌ Error in confirmOrder:', error);
        showError('Could not confirm order: ' + error.message);
    }
}

// ============================================================
// SHOW RIDERS 
// ============================================================
function showNearbyRiders(orderId, riders) {
    console.log('📍 Showing riders:', riders);
    
    const detailDiv = document.getElementById('orderDetail');
    
    if (!riders || riders.length === 0) {
        detailDiv.innerHTML = `
            <h3 style="margin-bottom: 8px;">👤 All Riders</h3>
            <p style="color: var(--gray-600);">No riders in the system. Please add a rider first.</p>
            <button class="btn btn-secondary" onclick="closeModal()" style="margin-top: 16px;">Close</button>
        `;
        document.getElementById('confirmBtn').style.display = 'none';
        return;
    }
    
    // Count how many have active deliveries
    const busyCount = riders.filter(r => r.status === 'busy').length;
    const availableCount = riders.filter(r => r.status === 'available').length;
    
    let subText = `${riders.length} rider${riders.length > 1 ? 's' : ''} available.`;
    if (busyCount > 0) {
        subText += ` ${busyCount} rider${busyCount > 1 ? 's' : ''} already has deliveries (can take more for batch).`;
    }
    
    const riderOptions = riders.map((rider) => {
        // Determine status display
        let statusDisplay = rider.status === 'available' ? '🟢 Available' : '🟡 Has deliveries (can take more)';
        let statusColor = rider.status === 'available' ? 'var(--secondary)' : 'var(--warning)';
        
        return `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; border: 1px solid var(--gray-200); border-radius: var(--radius); margin-bottom: 8px; cursor: pointer; transition: all 0.2s;" 
                 onmouseover="this.style.borderColor='var(--primary)'" 
                 onmouseout="this.style.borderColor='var(--gray-200)'"
                 onclick="assignRider('${orderId}', '${rider._id}')">
                <div>
                    <span style="font-weight: 600;">${rider.fullName}</span>
                    <span style="color: var(--gray-500); font-size: 13px; margin-left: 8px;">${rider.vehicleType}</span>
                    <div style="font-size: 13px; color: var(--gray-500);">
                        📍 ${rider.currentLocation?.city || 'Unknown'} • ${rider.totalDeliveries || 0} deliveries done
                    </div>
                </div>
                <div style="text-align: right;">
                    <span style="color: ${statusColor}; font-weight: 600;">
                        ${statusDisplay}
                    </span>
                    <div style="font-size: 12px; color: var(--gray-500);">
                        ${rider.deliveries?.length || 0} active deliveries
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    detailDiv.innerHTML = `
        <h3 style="margin-bottom: 8px;">👤 All Riders</h3>
        <p style="color: var(--gray-600); margin-bottom: 16px; font-size: 14px;">
            ${subText}
        </p>
        ${riderOptions}
        <button class="btn btn-secondary" onclick="closeModal()" style="margin-top: 16px; width: 100%;">Cancel</button>
    `;
    
    document.getElementById('confirmBtn').style.display = 'none';
}

// ============================================================
// ASSIGN RIDER 
// ============================================================
async function assignRider(orderId, riderId) {
    console.log('📡 Assigning rider:', riderId, 'to order:', orderId);
    
    try {
        const response = await fetch(`${API_URL}/orders/${orderId}/assign-rider`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ riderId })
        });
        
        const data = await response.json();
        console.log('📡 Assign response:', data);
        
        if (data.success) {
            showToast('✅ Rider assigned! Order is out for delivery.');
            closeModal();
            fetchOrders();
        } else {
            showError('Failed to assign rider: ' + (data.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('❌ Error assigning rider:', error);
        showError('Could not assign rider: ' + error.message);
    }
}

// ============================================================
// CLOSE MODAL
// ============================================================
function closeModal() {
    document.getElementById('orderModal').classList.remove('active');
    selectedOrderId = null;
}

// ============================================================
// REFRESH ORDERS
// ============================================================
function refreshOrders() {
    document.getElementById('orderList').innerHTML = '<div class="loading">Loading orders...</div>';
    fetchOrders();
}

// ============================================================
// ADD PRODUCT
// ============================================================
function addProduct() {
    alert('📦 Add Product feature coming soon!\n\nFor now, add products in MongoDB Compass.');
}

// ============================================================
// TOAST & ERROR NOTIFICATIONS
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

function showError(message) {
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed; bottom: 20px; right: 20px;
        background: var(--danger); color: white;
        padding: 16px 24px; border-radius: var(--radius);
        font-weight: 500; z-index: 9999;
        max-width: 400px; box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        animation: slideIn 0.3s ease;
    `;
    toast.textContent = `❌ ${message}`;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// ============================================================
// KEYBOARD SHORTCUTS
// ============================================================
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
});

// ============================================================
// AUTO REFRESH
// ============================================================
setInterval(() => {
    if (!document.getElementById('orderModal').classList.contains('active')) {
        fetchOrders();
    }
}, 30000);

// ============================================================
// LOAD DISTRIBUTOR FILTER
// ============================================================
async function loadDistributorFilter() {
    try {
        const response = await fetch(`${API_URL}/distributors`);
        const data = await response.json();
        
        if (data.success) {
            allDistributors = data.distributors;
            const select = document.getElementById('distributorFilter');
            if (select) {
                select.innerHTML = '<option value="all">All Distributors</option>';
                allDistributors.forEach(dist => {
                    const option = document.createElement('option');
                    option.value = dist._id;
                    option.textContent = dist.businessName;
                    select.appendChild(option);
                });
            }
        }
    } catch (error) {
        console.error('Error loading distributors:', error);
    }
}

// ============================================================
// SWITCH DISTRIBUTOR
// ============================================================
function switchDistributor() {
    const select = document.getElementById('distributorFilter');
    if (select) {
        selectedDistributorId = select.value;
        fetchOrders();
    }
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
// INITIAL LOAD
// ============================================================
console.log('✅ Distributor dashboard loaded!');
loadDistributorFilter();
fetchOrders();