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
// LOAD DISTRIBUTOR INFO IN SIDEBAR
// ============================================================
function loadDistributorInfo() {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    
    if (user && user.name) {
        // Set the distributor name
        const nameEl = document.getElementById('distributorName');
        if (nameEl) nameEl.textContent = user.name;
        
        // Set the avatar initials
        const initials = user.name
            .split(' ')
            .map(word => word[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
        const avatarEl = document.getElementById('distributorAvatar');
        if (avatarEl) avatarEl.textContent = initials;
    }
}

// ============================================================
// SHOW SECTION (Sidebar Navigation)
// ============================================================
function showSection(section) {
    // Remove active class from all nav items
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });

    // Add active class to clicked item
    if (event && event.currentTarget) {
        event.currentTarget.classList.add('active');
    }

    const orderList = document.getElementById('orderList');
    const statsContainer = document.getElementById('statsContainer');
    const ordersSection = document.querySelector('.orders-section');

    switch(section) {
        case 'dashboard':
        case 'orders':
            statsContainer.style.display = 'grid';
            if (ordersSection) ordersSection.style.display = 'block';
            orderList.innerHTML = '<div class="loading">Loading orders...</div>';
            fetchOrders();
            break;
        case 'products':
            // Show products message
            if (ordersSection) ordersSection.style.display = 'block';
            orderList.innerHTML = '<div class="loading">Loading products...</div>';
            loadDistributorProducts();
            break;
        case 'deliveries':
            if (ordersSection) ordersSection.style.display = 'block';
            orderList.innerHTML = '<div class="loading">Loading deliveries...</div>';
            loadDistributorDeliveries();
            break;
        case 'payments':
            if (ordersSection) ordersSection.style.display = 'block';
            orderList.innerHTML = '<div class="loading">Loading payments...</div>';
            loadDistributorPayments();
            break;
        case 'reports':
            if (ordersSection) ordersSection.style.display = 'block';
            orderList.innerHTML = '<div class="loading">Loading reports...</div>';
            loadDistributorReports();
            break;
       case 'settings':
        statsContainer.style.display = 'none';
        if (ordersSection) ordersSection.style.display = 'none';
        
        // Hide add product section // 
        const addProductSec = document.getElementById('addProductSection');
        if (addProductSec) addProductSec.style.display = 'none';
        
        // Show settings section
        const settingsSection = document.getElementById('settingsSection');
        if (settingsSection) {
            settingsSection.style.display = 'block';
            loadSettingsData(); // Load current settings
       }
       break;

       case 'dashboard':
       case 'orders':
        statsContainer.style.display = 'grid';
        if (ordersSection) ordersSection.style.display = 'block';
        
        // Hide settings section
        const settingsSec1 = document.getElementById('settingsSection');
        if (settingsSec1) settingsSec1.style.display = 'none';
        
        orderList.innerHTML = '<div class="loading">Loading orders...</div>';
        fetchOrders();
        break;
        default:
            fetchOrders();
    }
}

// ============================================================
// INITIAL LOAD
// ============================================================
console.log('✅ Distributor dashboard loaded!');
loadDistributorInfo();
loadDistributorFilter();
fetchOrders();

// ============================================================
// TOGGLE ADD PRODUCT FORM
// ============================================================
function toggleAddProductForm() {
    const section = document.getElementById('addProductSection');
    if (section.style.display === 'none') {
        section.style.display = 'block';
        section.scrollIntoView({ behavior: 'smooth' });
    } else {
        section.style.display = 'none';
    }
}

// ============================================================
// SAVE PRODUCT
// ============================================================
async function saveProduct(event) {
    event.preventDefault();
    
    const name = document.getElementById('productName').value;
    const category = document.getElementById('productCategory').value;
    const price = parseFloat(document.getElementById('productPrice').value);
    const unit = document.getElementById('productUnit').value;
    const size = document.getElementById('productSize').value;
    const stock = parseInt(document.getElementById('productStock').value);

    if (!name || !price || !stock) {
        showToast('⚠️ Please fill in all required fields');
        return;
    }

    try {
        const token = localStorage.getItem('token');
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        
        // Get the current distributor
        const distResponse = await fetch(`${API_URL}/distributors`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const distData = await distResponse.json();
        
        const distributor = distData.distributors.find(d => d._id === user.id);
        if (!distributor) {
            showToast('❌ Distributor not found');
            return;
        }

        const newProduct = {
            name: name,
            category: category,
            price: price,
            unit: unit,
            size: size,
            stock: stock
        };

        const products = [...(distributor.products || []), newProduct];

        const response = await fetch(`${API_URL}/distributors/${distributor._id}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ products: products })
        });

        const data = await response.json();
        if (data.success) {
            showToast('✅ Product added successfully!');
            document.getElementById('addProductForm').reset();
            toggleAddProductForm();
        } else {
            showToast('❌ Failed to add product: ' + (data.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error adding product:', error);
        showToast('❌ Failed to add product');
    }
}

// ============================================================
// LOAD SETTINGS DATA
// ============================================================
async function loadSettingsData() {
    try {
        const token = localStorage.getItem('token');
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        
        // Fetch distributor data
        const response = await fetch(`${API_URL}/distributors`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        
        if (data.success) {
            const distributor = data.distributors.find(d => d._id === user.id);
            if (distributor) {
                // Profile
                document.getElementById('settingsBusinessName').value = distributor.businessName || '';
                document.getElementById('settingsOwnerName').value = distributor.ownerName || '';
                document.getElementById('settingsPhone').value = distributor.phone || '';
                document.getElementById('settingsEmail').value = distributor.email || '';
                
                // Address
                document.getElementById('settingsStreet').value = distributor.address?.street || '';
                document.getElementById('settingsCity').value = distributor.address?.city || '';
                document.getElementById('settingsState').value = distributor.address?.state || '';
                document.getElementById('settingsLandmark').value = distributor.address?.landmark || '';
                
                // Delivery
                document.getElementById('settingsRadius').value = distributor.deliveryRadius || 10;
                document.getElementById('settingsMinOrder').value = distributor.minOrder || 0;
                document.getElementById('settingsDeliveryFee').value = distributor.deliveryFee || 0;
                document.getElementById('settingsHours').value = distributor.operatingHours || '';
                
                // Payment
                document.getElementById('settingsBankName').value = distributor.bankDetails?.bankName || '';
                document.getElementById('settingsAccountNumber').value = distributor.bankDetails?.accountNumber || '';
                document.getElementById('settingsAccountName').value = distributor.bankDetails?.accountName || '';
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
    await updateDistributorSettings({
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
    await updateDistributorSettings({
        address: {
            street: document.getElementById('settingsStreet').value,
            city: document.getElementById('settingsCity').value,
            state: document.getElementById('settingsState').value,
            landmark: document.getElementById('settingsLandmark').value
        }
    }, 'Address saved successfully!');
}

// ============================================================
// SAVE DELIVERY SETTINGS
// ============================================================
async function saveDelivery(event) {
    event.preventDefault();
    await updateDistributorSettings({
        deliveryRadius: parseInt(document.getElementById('settingsRadius').value) || 10,
        minOrder: parseInt(document.getElementById('settingsMinOrder').value) || 0,
        deliveryFee: parseInt(document.getElementById('settingsDeliveryFee').value) || 0,
        operatingHours: document.getElementById('settingsHours').value
    }, 'Delivery settings saved!');
}

// ============================================================
// SAVE PAYMENT DETAILS
// ============================================================
async function savePayment(event) {
    event.preventDefault();
    await updateDistributorSettings({
        bankDetails: {
            bankName: document.getElementById('settingsBankName').value,
            accountNumber: document.getElementById('settingsAccountNumber').value,
            accountName: document.getElementById('settingsAccountName').value
        }
    }, 'Payment details saved!');
}

// ============================================================
// SAVE NOTIFICATIONS
// ============================================================
async function saveNotifications() {
    const smsEnabled = document.getElementById('smsNotifications').checked;
    const whatsappEnabled = document.getElementById('whatsappNotifications').checked;
    
    await updateDistributorSettings({
        notifications: {
            sms: smsEnabled,
            whatsapp: whatsappEnabled
        }
    }, 'Notification settings saved!');
}

// ============================================================
// UPDATE DISTRIBUTOR SETTINGS (Helper)
// ============================================================
async function updateDistributorSettings(updates, successMessage) {
    try {
        const token = localStorage.getItem('token');
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        
        // Get current distributor
        const distResponse = await fetch(`${API_URL}/distributors`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const distData = await distResponse.json();
        
        const distributor = distData.distributors.find(d => d._id === user.id);
        if (!distributor) {
            showToast('❌ Distributor not found');
            return;
        }

        // Merge updates with existing data
        const mergedData = {
            ...distributor,
            ...updates,
            address: updates.address 
                ? { ...distributor.address, ...updates.address }
                : distributor.address,
            bankDetails: updates.bankDetails
                ? { ...distributor.bankDetails, ...updates.bankDetails }
                : distributor.bankDetails,
            notifications: updates.notifications
                ? { ...distributor.notifications, ...updates.notifications }
                : distributor.notifications
        };

        const response = await fetch(`${API_URL}/distributors/${distributor._id}`, {
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
            
            // Update localStorage if name or phone changed
            if (updates.businessName || updates.phone) {
                const updatedUser = {
                    ...user,
                    name: updates.businessName || user.name,
                    phone: updates.phone || user.phone
                };
                localStorage.setItem('user', JSON.stringify(updatedUser));
                loadDistributorInfo();
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
                role: 'distributor',
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
// LOAD DISTRIBUTOR PRODUCTS
// ============================================================
async function loadDistributorProducts() {
    try {
        const token = localStorage.getItem('token');
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        const orderList = document.getElementById('orderList');

        const response = await fetch(`${API_URL}/distributors`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();

        if (data.success) {
            const distributor = data.distributors.find(d => d._id === user.id);
            
            if (!distributor || !distributor.products || distributor.products.length === 0) {
                orderList.innerHTML = `
                    <div style="text-align: center; padding: 60px 20px;">
                        <p style="font-size: 48px;">📦</p>
                        <p style="font-size: 18px; font-weight: 600; color: var(--gray-700);">No Products Yet</p>
                        <p style="color: var(--gray-500); margin-top: 8px;">Click "+ Add Product" above to add your first product.</p>
                    </div>
                `;
                return;
            }

            orderList.innerHTML = distributor.products.map((product, index) => `
                <div class="order-card" style="display: flex; justify-content: space-between; align-items: center;">
                    <div class="order-info">
                        <div class="order-shop">📦 ${product.name}</div>
                        <div class="order-id">${product.category || 'General'} • ${product.size || ''} ${product.unit || ''}</div>
                        <div class="order-items">${product.stock || 0} in stock</div>
                    </div>
                    <div class="order-meta">
                        <div class="order-total">₦${product.price?.toLocaleString() || 0}</div>
                        <button class="btn btn-outline btn-sm" onclick="deleteProduct(${index})" style="margin-top: 8px;">🗑️ Delete</button>
                    </div>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('Error loading products:', error);
        document.getElementById('orderList').innerHTML = '<p style="text-align: center; color: var(--gray-500);">Failed to load products</p>';
    }
}

// ============================================================
// DELETE PRODUCT
// ============================================================
async function deleteProduct(index) {
    if (!confirm('Are you sure you want to delete this product?')) return;

    try {
        const token = localStorage.getItem('token');
        const user = JSON.parse(localStorage.getItem('user') || '{}');

        const distResponse = await fetch(`${API_URL}/distributors`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const distData = await distResponse.json();
        const distributor = distData.distributors.find(d => d._id === user.id);

        if (!distributor) {
            showToast('❌ Distributor not found');
            return;
        }

        const updatedProducts = distributor.products.filter((_, i) => i !== index);

        const response = await fetch(`${API_URL}/distributors/${distributor._id}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ products: updatedProducts })
        });

        const data = await response.json();
        if (data.success) {
            showToast('✅ Product deleted!');
            loadDistributorProducts();
        } else {
            showToast('❌ Failed to delete product');
        }
    } catch (error) {
        console.error('Error deleting product:', error);
        showToast('❌ Failed to delete product');
    }
}

// ============================================================
// LOAD DISTRIBUTOR DELIVERIES
// ============================================================
async function loadDistributorDeliveries() {
    try {
        const token = localStorage.getItem('token');
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        const orderList = document.getElementById('orderList');

        const response = await fetch(`${API_URL}/orders`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();

        if (data.success) {
            const deliveries = data.orders.filter(o => 
                o.distributorId?._id === user.id && 
                (o.status === 'picked_up' || o.status === 'out_for_delivery')
            );

            if (deliveries.length === 0) {
                orderList.innerHTML = `
                    <div style="text-align: center; padding: 60px 20px;">
                        <p style="font-size: 48px;">🚚</p>
                        <p style="font-size: 18px; font-weight: 600; color: var(--gray-700);">No Active Deliveries</p>
                        <p style="color: var(--gray-500); margin-top: 8px;">Deliveries will appear here when orders are picked up.</p>
                    </div>
                `;
                return;
            }

            orderList.innerHTML = deliveries.map(order => `
                <div class="order-card">
                    <div class="order-info">
                        <div class="order-shop">🏪 ${order.shopId?.businessName || 'Unknown Shop'}</div>
                        <div class="order-id">#${order._id.slice(-6).toUpperCase()}</div>
                        <div class="order-items">🏍️ Rider: ${order.riderId?.fullName || 'Not assigned'}</div>
                    </div>
                    <div class="order-meta">
                        <div class="order-total">₦${order.total?.toLocaleString() || 0}</div>
                        <span class="order-status ${order.status}">${order.status?.replace('_', ' ').toUpperCase()}</span>
                    </div>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('Error loading deliveries:', error);
    }
}

// ============================================================
// LOAD DISTRIBUTOR PAYMENTS
// ============================================================
async function loadDistributorPayments() {
    try {
        const token = localStorage.getItem('token');
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        const orderList = document.getElementById('orderList');

        const response = await fetch(`${API_URL}/orders`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();

        if (data.success) {
            const orders = data.orders.filter(o => o.distributorId?._id === user.id);

            const totalRevenue = orders.reduce((sum, o) => sum + (o.total || 0), 0);
            const deliveredRevenue = orders
                .filter(o => o.status === 'delivered')
                .reduce((sum, o) => sum + (o.total || 0), 0);
            const pendingRevenue = totalRevenue - deliveredRevenue;

            orderList.innerHTML = `
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 24px;">
                    <div style="background: white; padding: 20px; border-radius: 12px; text-align: center; border: 1px solid var(--gray-200);">
                        <p style="font-size: 28px; font-weight: 700; color: var(--primary);">₦${totalRevenue.toLocaleString()}</p>
                        <p style="font-size: 14px; color: var(--gray-600);">Total Revenue</p>
                    </div>
                    <div style="background: white; padding: 20px; border-radius: 12px; text-align: center; border: 1px solid var(--gray-200); border-left: 4px solid var(--secondary);">
                        <p style="font-size: 28px; font-weight: 700; color: var(--secondary);">₦${deliveredRevenue.toLocaleString()}</p>
                        <p style="font-size: 14px; color: var(--gray-600);">Paid</p>
                    </div>
                    <div style="background: white; padding: 20px; border-radius: 12px; text-align: center; border: 1px solid var(--gray-200); border-left: 4px solid var(--warning);">
                        <p style="font-size: 28px; font-weight: 700; color: var(--warning);">₦${pendingRevenue.toLocaleString()}</p>
                        <p style="font-size: 14px; color: var(--gray-600);">Pending</p>
                    </div>
                </div>
                <p style="font-weight: 600; margin-bottom: 12px; color: var(--gray-700);">Recent Payments</p>
                ${orders.slice(0, 10).map(order => `
                    <div class="order-card">
                        <div class="order-info">
                            <div class="order-shop">#${order._id.slice(-6).toUpperCase()}</div>
                            <div class="order-id">${new Date(order.createdAt).toLocaleDateString()}</div>
                        </div>
                        <div class="order-meta">
                            <div class="order-total">₦${order.total?.toLocaleString() || 0}</div>
                            <span class="order-status ${order.status}">${order.status?.replace('_', ' ').toUpperCase()}</span>
                        </div>
                    </div>
                `).join('')}
            `;
        }
    } catch (error) {
        console.error('Error loading payments:', error);
    }
}

// ============================================================
// LOAD DISTRIBUTOR REPORTS
// ============================================================
async function loadDistributorReports() {
    try {
        const token = localStorage.getItem('token');
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        const orderList = document.getElementById('orderList');

        const response = await fetch(`${API_URL}/orders`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();

        if (data.success) {
            const orders = data.orders.filter(o => o.distributorId?._id === user.id);
            
            const totalOrders = orders.length;
            const deliveredOrders = orders.filter(o => o.status === 'delivered').length;
            const pendingOrders = orders.filter(o => o.status === 'pending').length;
            const confirmedOrders = orders.filter(o => o.status === 'confirmed').length;
            
            const totalRevenue = orders.reduce((sum, o) => sum + (o.total || 0), 0);
            const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

            // Top products
            const productCount = {};
            orders.forEach(order => {
                (order.items || []).forEach(item => {
                    productCount[item.productName] = (productCount[item.productName] || 0) + item.quantity;
                });
            });
            const topProducts = Object.entries(productCount)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5);

            orderList.innerHTML = `
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-bottom: 24px;">
                    <div style="background: white; padding: 20px; border-radius: 12px; text-align: center; border: 1px solid var(--gray-200);">
                        <p style="font-size: 28px; font-weight: 700; color: var(--primary);">${totalOrders}</p>
                        <p style="font-size: 14px; color: var(--gray-600);">Total Orders</p>
                    </div>
                    <div style="background: white; padding: 20px; border-radius: 12px; text-align: center; border: 1px solid var(--gray-200);">
                        <p style="font-size: 28px; font-weight: 700; color: var(--primary);">₦${totalRevenue.toLocaleString()}</p>
                        <p style="font-size: 14px; color: var(--gray-600);">Total Revenue</p>
                    </div>
                    <div style="background: white; padding: 20px; border-radius: 12px; text-align: center; border: 1px solid var(--gray-200);">
                        <p style="font-size: 28px; font-weight: 700; color: var(--primary);">₦${avgOrderValue.toLocaleString()}</p>
                        <p style="font-size: 14px; color: var(--gray-600);">Avg Order Value</p>
                    </div>
                    <div style="background: white; padding: 20px; border-radius: 12px; text-align: center; border: 1px solid var(--gray-200);">
                        <p style="font-size: 28px; font-weight: 700; color: var(--primary);">${deliveredOrders}</p>
                        <p style="font-size: 14px; color: var(--gray-600);">Delivered</p>
                    </div>
                </div>

                <p style="font-weight: 600; margin-bottom: 12px; color: var(--gray-700);">📊 Order Status Breakdown</p>
                <div style="background: white; padding: 16px; border-radius: 12px; margin-bottom: 24px;">
                    <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--gray-100);">
                        <span>🟡 Pending</span><span>${pendingOrders}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--gray-100);">
                        <span>🔵 Confirmed</span><span>${confirmedOrders}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; padding: 8px 0;">
                        <span>🟢 Delivered</span><span>${deliveredOrders}</span>
                    </div>
                </div>

                <p style="font-weight: 600; margin-bottom: 12px; color: var(--gray-700);">🏆 Top Products</p>
                ${topProducts.length > 0 ? topProducts.map(([name, count]) => `
                    <div style="background: white; padding: 12px 16px; border-radius: 12px; margin-bottom: 8px; display: flex; justify-content: space-between;">
                        <span>${name}</span>
                        <span style="font-weight: 600;">${count} units</span>
                    </div>
                `).join('') : '<p style="color: var(--gray-500);">No products sold yet</p>'}
            `;
        }
    } catch (error) {
        console.error('Error loading reports:', error);
    }
}