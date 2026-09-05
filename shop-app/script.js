// API Configuration
const API_URL = 'https://restock-backend-zkrx.onrender.com/api';
let shops = [];
let distributors = [];
let allProducts = [];
let selectedShopId = null;
let cart = [];
let searchResults = [];
let currentSearchTerm = '';
let currentUser = null;

// ============================================================
// CHECK AUTHENTICATION
// ============================================================
function checkAuth() {
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    
    if (!token || !user) {
        console.log('⚠️ No user logged in. Redirecting to login...');
        window.location.href = '../landing-page/index.html';
        return false;
    }
    
    currentUser = user;
    console.log('✅ User logged in:', user);
    return true;
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
// GET AUTH HEADERS
// ============================================================
function getAuthHeaders() {
    const token = localStorage.getItem('token');
    return {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    };
}

// ============================================================
// LOAD SHOPS (UPDATED)
// ============================================================
async function loadShops() {
    try {
        if (!checkAuth()) return;
        
        const token = localStorage.getItem('token');
        console.log('📡 Fetching shops with auth...');
        
        const response = await fetch(`${API_URL}/shops`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const data = await response.json();
        console.log('📡 Shops response:', data);
        
        if (data.success) {
            shops = data.shops || [];
            const select = document.getElementById('shopSelect');
            
            if (!select) {
                console.error('❌ shopSelect element not found!');
                return;
            }
            
            // Clear existing options
            select.innerHTML = '';
            
            // Add placeholder option
            const placeholder = document.createElement('option');
            placeholder.value = '';
            placeholder.textContent = '-- Select your shop --';
            select.appendChild(placeholder);
            
            // Add shops to dropdown
            shops.forEach(shop => {
                const option = document.createElement('option');
                option.value = shop._id;
                const city = shop.address?.city || '';
                option.textContent = shop.businessName + (city ? ` (${city})` : '');
                select.appendChild(option);
            });
            
            console.log(`✅ Loaded ${shops.length} shops`);
            
            // If user is a shop owner and there's a matching shop, auto-select it
            if (currentUser && currentUser.role === 'shop') {
                const userShop = shops.find(shop => shop._id === currentUser.id);
                if (userShop) {
                    select.value = userShop._id;
                    console.log('✅ Auto-selected shop:', userShop.businessName);
                }
            }
            
            // If shops exist and nothing is selected, select the first one
            if (shops.length > 0 && !select.value) {
                select.value = shops[0]._id;
            }
            
            // Trigger shop selection
            selectShop();
        } else {
            console.error('❌ Failed to load shops:', data.error);
            if (data.error === 'Invalid or expired token') {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                window.location.href = '../landing-page/index.html';
            }
            showToast('Failed to load shops');
        }
    } catch (error) {
        console.error('Error loading shops:', error);
        showToast('Failed to load shops');
    }
}

// ============================================================
// SELECT SHOP
// ============================================================
function selectShop() {
    const select = document.getElementById('shopSelect');
    if (!select) return;
    
    selectedShopId = select.value;
    console.log('📍 Selected shop ID:', selectedShopId);
    
    if (!selectedShopId) {
        showToast('⚠️ Please select your shop first');
        return;
    }
    
    loadDistributors();
}

// ============================================================
// LOAD DISTRIBUTORS
// ============================================================
async function loadDistributors() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/distributors`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        const data = await response.json();
        
        if (data.success) {
            distributors = data.distributors;
            
            // Build product index with distributor info
            allProducts = [];
            distributors.forEach(dist => {
                if (dist.products && dist.products.length > 0) {
                    dist.products.forEach(product => {
                        allProducts.push({
                            ...product,
                            distributorId: dist._id,
                            distributorName: dist.businessName,
                            distributorPhone: dist.phone,
                            distributorAddress: dist.address,
                            distributorRating: dist.rating || 0
                        });
                    });
                }
            });
            
            console.log(`✅ Loaded ${distributors.length} distributors with ${allProducts.length} products`);
            
            if (allProducts.length === 0) {
                document.getElementById('resultsContainer').innerHTML = `
                    <div class="empty-state">
                        <p>📭</p>
                        <p>No products found</p>
                        <p style="color: var(--gray-500); font-size: 14px;">Distributors haven't added products yet.</p>
                    </div>
                `;
            } else {
                document.getElementById('resultsContainer').innerHTML = `
                    <div class="empty-state">
                        <p>🔍</p>
                        <p>Search for a product</p>
                        <p style="color: var(--gray-500); font-size: 14px;">${allProducts.length} products available from ${distributors.length} distributors</p>
                    </div>
                `;
            }
        } else {
            if (data.error === 'Invalid or expired token') {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                window.location.href = '../landing-page/index.html';
            }
            showToast('Failed to load distributors');
        }
    } catch (error) {
        console.error('Error loading distributors:', error);
        showToast('Failed to load distributors');
    }
}

// ============================================================
// SEARCH PRODUCTS
// ============================================================
function searchProducts() {
    const input = document.getElementById('searchInput');
    const term = input.value.trim();
    currentSearchTerm = term;
    
    if (!term) {
        document.getElementById('resultsContainer').innerHTML = `
            <div class="empty-state">
                <p>🔍</p>
                <p>Type a product name to search</p>
                <p style="color: var(--gray-500); font-size: 14px;">Example: "Indomie" shows all distributors selling it</p>
            </div>
        `;
        document.getElementById('resultsTitle').textContent = '🔍 Search for products to see distributors';
        document.getElementById('resultCount').textContent = '';
        return;
    }
    
    if (!selectedShopId) {
        showToast('⚠️ Please select your shop first');
        return;
    }
    
    const results = allProducts.filter(p => 
        p.name.toLowerCase().includes(term.toLowerCase()) ||
        p.category?.toLowerCase().includes(term.toLowerCase())
    );
    
    searchResults = results;
    renderResults(results, term);
}

// ============================================================
// UPLOAD IMAGE FOR AI ORDERING
// ============================================================
async function uploadImage() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('image', file);

        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_URL}/orders/ai-image`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });

            const data = await response.json();
            if (data.success) {
                showToast('✅ AI detected products! Review and confirm.');
                showAIResults(data.products);
            } else {
                showToast('❌ Could not read image. Please try again.');
            }
        } catch (error) {
            console.error('Image upload error:', error);
            showToast('❌ Failed to process image');
        }
    };
    input.click();
}

// ============================================================
// SHOW AI RESULTS
// ============================================================
function showAIResults(products) {
    let message = '🤖 AI Detected Products:\n\n';
    products.forEach((p, i) => {
        message += `${i+1}. ${p.name} x${p.quantity}\n`;
    });
    message += '\nConfirm to add to cart?';
    
    if (confirm(message)) {
        products.forEach(p => {
            // Search for product and add to cart
            quickSearch(p.name);
            // Then add to cart logic
        });
        showToast('✅ Products added to cart!');
    }
}

// ============================================================
// RENDER RESULTS 
// ============================================================
function renderResults(results, term) {
    const container = document.getElementById('resultsContainer');
    const title = document.getElementById('resultsTitle');
    const count = document.getElementById('resultCount');
    
    if (results.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <p>🔍</p>
                <p>No results found for "${term}"</p>
                <p style="color: var(--gray-500); font-size: 14px;">Try a different keyword or check spelling</p>
            </div>
        `;
        title.textContent = `🔍 No results found`;
        count.textContent = '';
        return;
    }
    
    const grouped = {};
    results.forEach(product => {
        const key = product.distributorId;
        if (!grouped[key]) {
            const dist = distributors.find(d => d._id === key);
            grouped[key] = {
                distributorId: key,
                distributorName: product.distributorName,
                distributorAddress: product.distributorAddress,
                distributorRating: product.distributorRating || 0,
                products: []
            };
        }
        grouped[key].products.push(product);
    });
    
    const sortedGroups = Object.values(grouped).sort((a, b) => b.distributorRating - a.distributorRating);
    
    title.textContent = `📦 Results for "${term}"`;
    count.textContent = `${results.length} product${results.length > 1 ? 's' : ''} from ${sortedGroups.length} distributor${sortedGroups.length > 1 ? 's' : ''}`;
    
    container.innerHTML = sortedGroups.map(group => {
        const address = group.distributorAddress;
        const location = address ? `${address.city || ''}, ${address.state || ''}` : 'Location not specified';
        const stars = '⭐'.repeat(Math.round(group.distributorRating));
        
        return `
            <div class="distributor-group">
                <div class="distributor-header">
                    <div>
                        <span class="dist-name">🏪 ${group.distributorName}</span>
                        <span class="dist-location">📍 ${location}</span>
                    </div>
                    <div>
                        <span class="dist-rating">${stars || 'No ratings yet'}</span>
                    </div>
                </div>
                ${group.products.map(product => {
                    const inCart = cart.find(item => 
                        item.productId === product._id && 
                        item.distributorId === product.distributorId
                    );
                    const qty = inCart ? inCart.quantity : 0;
                    const stock = product.stock || 0;
                    
                    
                    const sizeDisplay = product.size ? ` • ${product.size}` : '';
                    const unitDisplay = product.unit ? ` / ${product.unit}` : '';
                    
                    return `
                        <div class="product-item">
                            <div class="product-info">
                                <span class="product-name">${product.name}${sizeDisplay}${unitDisplay}</span>
                                <span class="product-stock">${stock} in stock</span>
                            </div>
                            <div style="display: flex; align-items: center; gap: 16px; flex-wrap: wrap;">
                                <span class="product-price">₦${product.price?.toLocaleString() || 0}</span>
                                <div class="product-actions">
                                    ${qty > 0 ? `
                                        <div class="qty-control">
                                            <button onclick="updateCart('${product._id}', '${product.distributorId}', -1)">−</button>
                                            <span>${qty}</span>
                                            <button onclick="updateCart('${product._id}', '${product.distributorId}', 1)">+</button>
                                        </div>
                                    ` : `
                                        <button class="btn btn-primary btn-sm" onclick="addToCart('${product._id}', '${product.distributorId}')">
                                            + Add
                                        </button>
                                    `}
                                </div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }).join('');
}

// ============================================================
// QUICK SEARCH
// ============================================================
function quickSearch(term) {
    document.getElementById('searchInput').value = term;
    searchProducts();
}

// ============================================================
// ADD TO CART
// ============================================================
function addToCart(productId, distributorId) {
    if (!selectedShopId) {
        showToast('⚠️ Please select a shop first');
        return;
    }
    
    const product = allProducts.find(p => p._id === productId && p.distributorId === distributorId);
    if (!product) return;
    
    const existing = cart.find(item => item.productId === productId && item.distributorId === distributorId);
    
    if (existing) {
        if (existing.quantity >= (product.stock || 0)) {
            showToast('⚠️ Not enough stock');
            return;
        }
        existing.quantity += 1;
    } else {
        cart.push({
            productId: product._id,
            distributorId: product.distributorId,
            distributorName: product.distributorName,
            name: product.name,
            price: product.price || 0,
            quantity: 1,
            stock: product.stock || 0
        });
    }
    
    updateCartBadge();
    renderResults(searchResults, currentSearchTerm);
    showToast(`✅ Added ${product.name} to cart`);
}

// ============================================================
// UPDATE CART
// ============================================================
function updateCart(productId, distributorId, delta) {
    const item = cart.find(i => i.productId === productId && i.distributorId === distributorId);
    if (!item) return;
    
    const newQty = item.quantity + delta;
    if (newQty <= 0) {
        const index = cart.indexOf(item);
        cart.splice(index, 1);
    } else {
        item.quantity = newQty;
    }
    
    updateCartBadge();
    renderResults(searchResults, currentSearchTerm);
}

// ============================================================
// UPDATE CART BADGE
// ============================================================
function updateCartBadge() {
    const total = cart.reduce((sum, item) => sum + item.quantity, 0);
    document.getElementById('cartCount').textContent = total;
}

// ============================================================
// VIEW CART
// ============================================================
function viewCart() {
    if (cart.length === 0) {
        showToast('🛒 Your cart is empty');
        return;
    }
    renderCart();
    document.getElementById('cartModal').classList.add('active');
}

// ============================================================
// RENDER CART
// ============================================================
function renderCart() {
    const container = document.getElementById('cartItems');
    const totalContainer = document.getElementById('cartTotal');
    
    if (cart.length === 0) {
        container.innerHTML = '<p style="color: var(--gray-500); text-align: center; padding: 20px;">Your cart is empty</p>';
        totalContainer.textContent = '₦0';
        return;
    }
    
    let total = 0;
    container.innerHTML = cart.map(item => {
        const itemTotal = item.price * item.quantity;
        total += itemTotal;
        return `
            <div class="cart-item">
                <div class="item-info">
                    <span class="item-name">${item.name}</span>
                    <span class="item-distributor">from ${item.distributorName}</span>
                    <span class="item-price">₦${item.price?.toLocaleString()} × ${item.quantity}</span>
                </div>
                <div class="item-actions">
                    <button onclick="updateCart('${item.productId}', '${item.distributorId}', -1)">−</button>
                    <span class="item-qty">${item.quantity}</span>
                    <button onclick="updateCart('${item.productId}', '${item.distributorId}', 1)">+</button>
                </div>
            </div>
        `;
    }).join('');
    
    totalContainer.textContent = `₦${total.toLocaleString()}`;
}

// ============================================================
// CLOSE CART
// ============================================================
function closeCart() {
    document.getElementById('cartModal').classList.remove('active');
}

// ============================================================
// PLACE ORDER (UPDATED with auth)
// ============================================================
async function placeOrder() {
    if (!selectedShopId) {
        showToast('⚠️ Please select a shop first');
        return;
    }
    
    if (cart.length === 0) {
        showToast('⚠️ Your cart is empty');
        return;
    }
    
    closeCart();
    
    try {
        const token = localStorage.getItem('token');
        const itemsByDistributor = {};
        cart.forEach(item => {
            if (!itemsByDistributor[item.distributorId]) {
                itemsByDistributor[item.distributorId] = [];
            }
            itemsByDistributor[item.distributorId].push(item);
        });
        
        let ordersPlaced = 0;
        let orderNumbers = [];
        const shop = shops.find(s => s._id === selectedShopId);
        
        if (!shop) {
            showToast('❌ Shop not found. Please select a shop again.');
            return;
        }
        
        for (const [distributorId, items] of Object.entries(itemsByDistributor)) {
            const orderItems = items.map(item => ({
                productName: item.name,
                quantity: item.quantity,
                price: item.price,
                total: item.price * item.quantity
            }));
            
            const subtotal = orderItems.reduce((sum, item) => sum + item.total, 0);
            
            const orderData = {
                shopId: selectedShopId,
                distributorId: distributorId,
                items: orderItems,
                subtotal: subtotal,
                deliveryFee: 0,
                total: subtotal,
                paymentMethod: 'cash_on_delivery',
                deliveryAddress: {
                    shopName: shop.businessName || '',
                    address: shop.address?.street || '',
                    city: shop.address?.city || '',
                    state: shop.address?.state || '',
                    landmark: shop.address?.landmark || ''
                }
            };
            
            console.log('📦 Sending order:', JSON.stringify(orderData, null, 2));
            
            const response = await fetch(`${API_URL}/orders`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(orderData)
            });
            
            const data = await response.json();
            console.log('📦 Response:', data);
            
            if (data.success) {
                ordersPlaced++;
                orderNumbers.push(data.order._id.slice(-6).toUpperCase());
            } else {
                console.error('❌ Order failed:', data.error);
                if (data.error === 'Invalid or expired token') {
                    localStorage.removeItem('token');
                    localStorage.removeItem('user');
                    window.location.href = '../landing-page/index.html';
                }
                showToast(`❌ Order failed: ${data.error || 'Unknown error'}`);
                return;
            }
        }
        
        if (ordersPlaced > 0) {
            cart = [];
            updateCartBadge();
            renderResults(searchResults, currentSearchTerm);
            
            document.getElementById('orderNumber').textContent = orderNumbers.join(', ');
            document.getElementById('confirmModal').classList.add('active');
            showToast(`✅ ${ordersPlaced} order${ordersPlaced > 1 ? 's' : ''} placed!`);
        }
    } catch (error) {
        console.error('❌ Place order error:', error);
        showToast(`❌ Error: ${error.message || 'Failed to place order'}`);
    }
}

// ============================================================
// CLOSE CONFIRMATION
// ============================================================
function closeConfirm() {
    document.getElementById('confirmModal').classList.remove('active');
}

// ============================================================
// TOAST NOTIFICATIONS
// ============================================================
function showToast(message) {
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: var(--gray-900);
        color: white;
        padding: 16px 24px;
        border-radius: var(--radius);
        font-weight: 500;
        z-index: 9999;
        max-width: 400px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
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
// KEYBOARD SHORTCUTS
// ============================================================
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeCart();
        closeConfirm();
    }
    if (e.key === 'Enter') {
        const searchInput = document.getElementById('searchInput');
        if (document.activeElement === searchInput) {
            searchProducts();
        }
    }
});

// ============================================================
// INITIAL LOAD
// ============================================================
console.log('🚀 Shop App loading...');
loadShops();