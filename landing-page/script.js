// ============================================================
// ROLE SELECTION
// ============================================================
let selectedRole = 'shop';

function selectRole(role) {
    selectedRole = role;
    document.querySelectorAll('.role-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.textContent.includes('Shop') || 
            (role === 'shop' && btn.textContent.includes('Shop')) ||
            (role === 'distributor' && btn.textContent.includes('Distributor')) ||
            (role === 'rider' && btn.textContent.includes('Rider'))) {
            btn.classList.add('active');
        }
    });
}

// ============================================================
// API URL
// ============================================================
const API_URL = 'https://restock-backend-zkrx.onrender.com/api';

// ============================================================
// MODAL CONTROLS
// ============================================================
function openLogin() {
    closeModal('registerModal');
    document.getElementById('loginModal').classList.add('active');
}

function openRegister() {
    closeModal('loginModal');
    document.getElementById('registerModal').classList.add('active');
}

function closeModal(id) {
    document.getElementById(id).classList.remove('active');
}

// Close modal on outside click
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
        e.target.classList.remove('active');
    }
});

// Close modal on Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        document.querySelectorAll('.modal.active').forEach(modal => {
            modal.classList.remove('active');
        });
    }
});

// ============================================================
// HANDLE LOGIN
// ============================================================
async function handleLogin(event) {
    event.preventDefault();
    const phone = document.getElementById('loginPhone').value;
    const password = document.getElementById('loginPassword').value;

    if (!phone || !password) {
        alert('Please fill in all fields');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                phone: phone,
                password: password,
                role: selectedRole
            })
        });

        const data = await response.json();

        if (data.success) {
            // Save token and user info
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            
            // Redirect based on role
            const roleMap = {
                shop: '../shop-app/index.html',
                distributor: '../distributor-dashboard/index.html',
                rider: '../rider-app/index.html'
            };
            
            window.location.href = roleMap[selectedRole] || '../shop-app/index.html';
        } else {
            alert('❌ ' + (data.error || 'Login failed'));
        }
    } catch (error) {
        console.error('Login error:', error);
        alert('❌ Login failed. Please try again.');
    }
}

// ============================================================
// HANDLE REGISTER
// ============================================================
async function handleRegister(event) {
    event.preventDefault();
    const business = document.getElementById('registerBusiness').value;
    const name = document.getElementById('registerName').value;
    const phone = document.getElementById('registerPhone').value;
    const password = document.getElementById('registerPassword').value;

    if (!business || !name || !phone || !password) {
        alert('Please fill in all fields');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                role: selectedRole,
                businessName: business,
                ownerName: name,
                phone: phone,
                password: password
            })
        });

        const data = await response.json();

        if (data.success) {
            alert('✅ Account created successfully! Please log in.');
            closeModal('registerModal');
            openLogin();
        } else {
            alert('❌ ' + (data.error || 'Registration failed'));
        }
    } catch (error) {
        console.error('Registration error:', error);
        alert('❌ Registration failed. Please try again.');
    }
}

// ============================================================
// SMOOTH SCROLL
// ============================================================
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    });
});

// ============================================================
// CHECK IF USER IS ALREADY LOGGED IN
// ============================================================
function checkAuth() {
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    
    // Check if token is still valid
    if (token && user) {
        // Verify token with backend
        fetch(`${API_URL}/auth/me`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                // Token is valid, redirect to dashboard
                const roleMap = {
                    shop: '../shop-app/index.html',
                    distributor: '../distributor-dashboard/index.html',
                    rider: '../rider-app/index.html'
                };
                window.location.href = roleMap[user.role] || '../shop-app/index.html';
            } else {
                // Token is invalid, clear it
                localStorage.removeItem('token');
                localStorage.removeItem('user');
            }
        })
        .catch(() => {
            // If verification fails, clear localStorage
            localStorage.removeItem('token');
            localStorage.removeItem('user');
        });
    }
}

// Check auth on page load
checkAuth();