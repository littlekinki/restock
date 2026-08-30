// ============================================================
// API Configuration
// ============================================================
const API_URL = 'https://restock-backend-zkrx.onrender.com/api';
let riders = [];
let selectedRiderId = null;
let deliveries = [];
let currentFilter = 'all';
let currentOrderId = null;

// ============================================================
// LOAD RIDERS
// ============================================================
async function loadRiders() {
    try {
        const response = await fetch(`${API_URL}/riders`);
        const data = await response.json();
        
        if (data.success) {
            riders = data.riders;
            const select = document.getElementById('riderSelect');
            select.innerHTML = '<option value="">-- Select a rider --</option>';
            
            riders.forEach(rider => {
                const option = document.createElement('option');
                option.value = rider._id;
                option.textContent = rider.fullName + ' (' + rider.vehicleType + ')';
                select.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error loading riders:', error);
        showToast('Failed to load riders', 'error');
    }
}

// ============================================================
// SELECT RIDER
// ============================================================
function selectRider() {
    const select = document.getElementById('riderSelect');
    selectedRiderId = select.value;
    
    if (!selectedRiderId) {
        document.getElementById('riderDetails').style.display = 'none';
        document.getElementById('deliveryList').innerHTML = 
            '<div class="empty-state"><p>👤</p><p>Select a rider to see deliveries</p></div>';
        return;
    }
    
    const rider = riders.find(r => r._id === selectedRiderId);
    if (rider) {
        document.getElementById('riderDetails').style.display = 'flex';
        document.getElementById('riderPhone').textContent = rider.phone || 'N/A';
        document.getElementById('riderVehicle').textContent = 
            rider.vehicleType + (rider.vehiclePlate ? ' (' + rider.vehiclePlate + ')' : '');
        document.getElementById('riderEarnings').textContent = '₦' + (rider.earnings?.toLocaleString() || 0);
        document.getElementById('riderDeliveries').textContent = rider.totalDeliveries || 0;
        
        const badge = document.getElementById('statusBadge');
        if (rider.status === 'available') {
            badge.textContent = '🟢 Available';
            badge.className = 'status-badge';
        } else {
            badge.textContent = '🔴 Busy';
            badge.className = 'status-badge offline';
        }
        
        loadDeliveries();
    }
}

// ============================================================
// TOGGLE RIDER STATUS
// ============================================================
async function toggleStatus() {
    if (!selectedRiderId) {
        showToast('Please select a rider first', 'warning');
        return;
    }
    
    const rider = riders.find(r => r._id === selectedRiderId);
    if (!rider) return;
    
    const newStatus = rider.status === 'available' ? 'busy' : 'available';
    
    try {
        const response = await fetch(`${API_URL}/riders/${selectedRiderId}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus })
        });
        
        const data = await response.json();
        if (data.success) {
            rider.status = newStatus;
            selectRider();
            showToast(`Status changed to ${newStatus}`, 'success');
        }
    } catch (error) {
        console.error('Error toggling status:', error);
        showToast('Failed to update status', 'error');
    }
}

// ============================================================
// LOAD DELIVERIES
// ============================================================
async function loadDeliveries() {
    if (!selectedRiderId) return;
    
    try {
        const response = await fetch(`${API_URL}/orders?riderId=${selectedRiderId}`);
        const data = await response.json();
        
        if (data.success) {
            deliveries = data.orders;
            updateStats();
            renderDeliveries();
        }
    } catch (error) {
        console.error('Error loading deliveries:', error);
        showToast('Failed to load deliveries', 'error');
    }
}

// ============================================================
// UPDATE STATS
// ============================================================
function updateStats() {
    const pending = deliveries.filter(d => d.status === 'picked_up' || d.status === 'out_for_delivery');
    const today = new Date().toDateString();
    const todayDeliveries = deliveries.filter(d => 
        d.status === 'delivered' && new Date(d.updatedAt).toDateString() === today
    );
    const todayEarnings = todayDeliveries.reduce((sum, d) => sum + (d.deliveryFee || 0), 0);
    
    document.getElementById('pendingDeliveries').textContent = pending.length;
    document.getElementById('todayEarnings').textContent = '₦' + todayEarnings.toLocaleString();
    document.getElementById('totalDeliveries').textContent = deliveries.filter(d => d.status === 'delivered').length;
}

// ============================================================
// RENDER DELIVERIES
// ============================================================
function renderDeliveries() {
    const container = document.getElementById('deliveryList');
    
    let filtered = deliveries;
    if (currentFilter !== 'all') {
        filtered = deliveries.filter(d => d.status === currentFilter);
    }
    
    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <p>📭</p>
                <p>${deliveries.length === 0 ? 'No deliveries assigned yet' : 'No ' + currentFilter + ' deliveries'}</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = filtered.map(delivery => {
        const shopName = delivery.shopId?.businessName || 'Unknown Shop';
        const itemsSummary = delivery.items?.map(i => 
            i.productName + ' x' + i.quantity
        ).join(', ') || 'No items';
        const statusClass = delivery.status;
        const statusDisplay = delivery.status?.replace('_', ' ').toUpperCase() || 'PENDING';
        
        return `
            <div class="delivery-card" onclick="openDelivery('${delivery._id}')">
                <div class="delivery-info">
                    <div class="delivery-shop">🏪 ${shopName}</div>
                    <div class="delivery-id">#${delivery._id.slice(-6).toUpperCase()}</div>
                    <div class="delivery-items">${itemsSummary}</div>
                </div>
                <div class="delivery-meta">
                    <div class="delivery-total">₦${delivery.total?.toLocaleString() || 0}</div>
                    <span class="delivery-status ${statusClass}">${statusDisplay}</span>
                </div>
            </div>
        `;
    }).join('');
}

// ============================================================
// FILTER DELIVERIES
// ============================================================
function filterDeliveries(filter) {
    currentFilter = filter;
    document.querySelectorAll('.filter-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.filter === filter);
    });
    renderDeliveries();
}

// ============================================================
// OPEN DELIVERY DETAIL 
// ============================================================
async function openDelivery(orderId) {
    if (!orderId || orderId === 'null' || orderId === 'undefined') {
        showToast('Invalid order ID', 'error');
        return;
    }

    currentOrderId = orderId;
    const modal = document.getElementById('deliveryModal');

    try {
        const response = await fetch(`${API_URL}/orders/${orderId}`);
        const data = await response.json();

        if (!data.success) {
            showToast('Failed to load delivery details', 'error');
            return;
        }

        const order = data.order;
        const shop = order.shopId || {};
        const pickup = order.pickupAddress || {};

        // ============================================================
        // DETAIL HTML - NO PIN DISPLAY
        // ============================================================
        const detailHtml = `
            <div style="margin-bottom: 20px;">
                <h3 style="font-size: 18px; margin-bottom: 4px;">🏪 ${shop.businessName || 'Unknown Shop'}</h3>
                <p style="color: var(--gray-500); font-size: 14px;">Order #${order._id.slice(-6).toUpperCase()}</p>
                <p style="color: var(--gray-600); font-size: 14px;">📍 Delivery: ${shop.address?.street || ''} ${shop.address?.city || ''}</p>
                <p style="color: var(--gray-600); font-size: 14px;">📞 ${shop.phone || 'No phone'}</p>
            </div>

            <!-- ✅ Rider sees THIS message - NOT the PIN value -->
            <div style="margin-bottom: 16px; background: #FFF3E0; padding: 12px 16px; border-radius: var(--radius); border-left: 4px solid #E65100;">
                <p style="font-weight: 600; font-size: 14px; color: #E65100;">🔑 Ask Customer for Delivery PIN</p>
                <p style="color: var(--gray-600); font-size: 13px; margin-top: 4px;">
                    The customer has a 4-digit PIN. Ask them for it and enter it below to confirm delivery.
                </p>
            </div>

            ${pickup.distributorName ? `
            <div style="margin-bottom: 16px; background: #E3F2FD; padding: 12px 16px; border-radius: var(--radius); border-left: 4px solid #0D47A1;">
                <p style="font-weight: 600; font-size: 13px; color: #0D47A1;">📦 Pickup from Distributor</p>
                <p style="font-weight: 600; font-size: 14px;">${pickup.distributorName}</p>
                <p style="color: var(--gray-600); font-size: 14px;">📍 ${pickup.address || ''} ${pickup.city || ''}</p>
                <p style="color: var(--gray-600); font-size: 14px;">📞 ${pickup.phone || 'No phone'}</p>
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
                <div style="display: flex; justify-content: space-between; font-weight: 700; font-size: 18px;">
                    <span>Total</span>
                    <span>₦${order.total?.toLocaleString() || 0}</span>
                </div>
            </div>

            <div style="margin-bottom: 16px;">
                <p style="font-weight: 600; font-size: 14px; margin-bottom: 8px;">Status:</p>
                <span class="delivery-status ${order.status}">${order.status?.replace('_', ' ').toUpperCase() || 'Pending'}</span>
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

        document.getElementById('deliveryDetail').innerHTML = detailHtml;

        // ============================================================
        // SHOW/HIDE BUTTONS AND PIN SECTION
        // ============================================================
        const pickupBtn = document.getElementById('pickupBtn');
        const deliverBtn = document.getElementById('deliverBtn');
        const pinSection = document.getElementById('pinSection');
        const pinInput = document.getElementById('deliveryPinInput');
        const pinError = document.getElementById('pinError');

        // Hide all first
        pickupBtn.style.display = 'none';
        deliverBtn.style.display = 'none';
        pinSection.style.display = 'none';

        if (order.status === 'confirmed') {
            // Order is ready for pickup
            pickupBtn.style.display = 'inline-block';
            pickupBtn.textContent = '📦 Pick Up Order';
            
        } else if (order.status === 'picked_up' || order.status === 'out_for_delivery') {
            // Order is out for delivery - show PIN INPUT section
            pinSection.style.display = 'block';
            pinInput.value = '';
            pinError.style.display = 'none';
            setTimeout(() => pinInput.focus(), 500);
            
        } else if (order.status === 'delivered') {
            // Already delivered - nothing to show
            pickupBtn.style.display = 'none';
            deliverBtn.style.display = 'none';
            pinSection.style.display = 'none';
        }

        modal.classList.add('active');

    } catch (error) {
        console.error('Error fetching delivery details:', error);
        showToast('Failed to load delivery details', 'error');
    }
}

// ============================================================
// PICK UP DELIVERY
// ============================================================
async function pickupDelivery() {
    if (!currentOrderId) return;
    
    try {
        const response = await fetch(`${API_URL}/orders/${currentOrderId}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                status: 'picked_up', 
                note: 'Rider picked up the order from distributor' 
            })
        });
        
        const data = await response.json();
        if (data.success) {
            showToast('✅ Order picked up! Now deliver to the shop.', 'success');
            closeModal();
            loadDeliveries();
            selectRider();
        } else {
            showToast('Failed to pick up order', 'error');
        }
    } catch (error) {
        console.error('Error picking up delivery:', error);
        showToast('Failed to pick up order', 'error');
    }
}

// ============================================================
// DELIVER ORDER
// ============================================================
async function deliverOrder() {
    if (!currentOrderId) return;
    
    try {
        const response = await fetch(`${API_URL}/orders/${currentOrderId}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                status: 'delivered', 
                note: 'Order delivered to shop successfully' 
            })
        });
        
        const data = await response.json();
        if (data.success) {
            showToast('✅ Order delivered! 🎉', 'success');
            closeModal();
            loadDeliveries();
            selectRider();
        } else {
            showToast('Failed to mark as delivered', 'error');
        }
    } catch (error) {
        console.error('Error delivering order:', error);
        showToast('Failed to mark as delivered', 'error');
    }
}

// ============================================================
// CLOSE MODAL
// ============================================================
function closeModal() {
    document.getElementById('deliveryModal').classList.remove('active');
    currentOrderId = null;
}

// ============================================================
// REFRESH DELIVERIES
// ============================================================
function refreshDeliveries() {
    if (selectedRiderId) {
        loadDeliveries();
        showToast('🔄 Refreshed!', 'info');
    } else {
        showToast('Please select a rider first', 'warning');
    }
}

// ============================================================
// TOAST NOTIFICATIONS
// ============================================================
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        toast.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
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
    if (selectedRiderId) {
        loadDeliveries();
    }
}, 30000);

// ============================================================
// VERIFY DELIVERY PIN
// ============================================================
async function verifyDeliveryPIN() {
    if (!currentOrderId) {
        showToast('No order selected', 'error');
        return;
    }

    const pinInput = document.getElementById('deliveryPinInput');
    const pin = pinInput.value.trim();
    const errorEl = document.getElementById('pinError');

    if (!pin || pin.length !== 4 || !/^\d{4}$/.test(pin)) {
        errorEl.textContent = '⚠️ Please enter a valid 4-digit PIN';
        errorEl.style.display = 'block';
        return;
    }

    errorEl.style.display = 'none';

    try {
        const response = await fetch(`${API_URL}/orders/${currentOrderId}/verify-pin`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pin })
        });

        const data = await response.json();

        if (data.success) {
            showToast('✅ Delivery confirmed! Order completed.', 'success');
            closeModal();
            loadDeliveries();
            selectRider();
        } else {
            errorEl.textContent = '❌ ' + (data.error || 'Invalid PIN. Please try again.');
            errorEl.style.display = 'block';
            pinInput.value = '';
            pinInput.focus();
        }
    } catch (error) {
        console.error('PIN verification error:', error);
        showToast('❌ Failed to verify PIN. Please try again.', 'error');
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
console.log('✅ Rider dashboard loaded!');
loadRiders();