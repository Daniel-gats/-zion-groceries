// ===== Zion Groceries - Customer Dashboard =====

const IS_FILE_MODE = window.location.protocol === 'file:';
const API_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost:3000/api' 
    : '/api';

let currentUser = null;
let authToken = null;

function readJson(key, fallback = []) {
    try {
        return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback;
    } catch {
        return fallback;
    }
}

function normalizeLocalOrder(order) {
    return {
        orderNumber: order.orderNumber || order.id,
        createdAt: order.createdAt || order.date || new Date().toISOString(),
        status: order.status || 'pending',
        paymentMethod: order.paymentMethod || 'cash',
        paymentStatus: order.paymentStatus || 'pending',
        totalAmount: Number(order.totalAmount ?? order.total ?? 0),
        deliveryAddress: order.deliveryAddress || order.customer?.hostel || '',
        deliveryCity: order.deliveryCity || order.customer?.hostel || '',
        items: (order.items || []).map(item => ({
            productName: item.productName || item.name || 'Item',
            quantity: item.quantity || item.qty || 1,
            productPrice: Number(item.productPrice ?? item.price ?? 0),
            subtotal: Number(item.subtotal ?? ((item.productPrice ?? item.price ?? 0) * (item.quantity || item.qty || 1)))
        }))
    };
}

// Check authentication
function checkAuth() {
    authToken = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    
    if (!authToken || !userStr) {
        if (IS_FILE_MODE) {
            currentUser = { id: 'local-guest', fullName: 'Local Customer', email: 'local@zion.shop', phone: localStorage.getItem('customerPhone') || '', city: localStorage.getItem('hostel') || '', address: localStorage.getItem('room') || '' };
            localStorage.setItem('token', `local-${Date.now()}`);
            localStorage.setItem('user', JSON.stringify(currentUser));
            authToken = localStorage.getItem('token');
            return true;
        }
        window.location.href = 'login.html?return=dashboard.html';
        return false;
    }
    
    currentUser = JSON.parse(userStr);
    return true;
}

// Initialize dashboard
async function initDashboard() {
    if (!checkAuth()) return;
    
    // Display user name
    document.getElementById('userName').textContent = currentUser.fullName;
    
    // Load data
    await Promise.all([
        loadOrders(),
        loadReviews(),
        loadProfile()
    ]);
}

// Load user orders
async function loadOrders() {
    const ordersContent = document.getElementById('ordersContent');
    const ordersLoading = document.getElementById('ordersLoading');
    
    try {
        if (IS_FILE_MODE) {
            const localOrders = readJson('zion-orders', readJson('g-man-orders', [])).map(normalizeLocalOrder);
            ordersLoading.style.display = 'none';
            ordersContent.style.display = 'block';
            renderDashboardOrders(localOrders);
            return;
        }
        const response = await fetch(`${API_URL}/orders/my-orders`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to fetch orders');
        }
        
        const data = await response.json();
        const orders = data.orders;
        
        ordersLoading.style.display = 'none';
        ordersContent.style.display = 'block';
        
        if (orders.length === 0) {
            ordersContent.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-box-open"></i>
                    <h3>No Orders Yet</h3>
                    <p>You haven't placed any orders yet.</p>
                    <a href="index.html" class="btn-primary">
                        <i class="fas fa-shopping-cart"></i> Start Shopping
                    </a>
                </div>
            `;
            return;
        }
        
        renderDashboardOrders(orders);
        
    } catch (error) {
        console.error('Error loading orders:', error);
        ordersLoading.style.display = 'none';
        ordersContent.style.display = 'block';
        ordersContent.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-triangle"></i>
                <h3>Error Loading Orders</h3>
                <p>Unable to load your orders. Please try again later.</p>
            </div>
        `;
    }
}

function renderDashboardOrders(orders) {
    if (orders.length === 0) {
        document.getElementById('ordersContent').innerHTML = `
            <div class="empty-state">
                <i class="fas fa-box-open"></i>
                <h3>No Orders Yet</h3>
                <p>You haven't placed any orders yet.</p>
                <a href="index.html" class="btn-primary">
                    <i class="fas fa-shopping-cart"></i> Start Shopping
                </a>
            </div>
        `;
        return;
    }

    document.getElementById('totalOrders').textContent = orders.length;
    const totalSpent = orders
        .filter(o => o.status !== 'cancelled')
        .reduce((sum, o) => sum + Number(o.totalAmount || 0), 0);
    document.getElementById('totalSpent').textContent = `KSh ${totalSpent.toLocaleString()}`;
    document.getElementById('ordersContent').innerHTML = orders.map(order => `
            <div class="order-item">
                <div class="order-header">
                    <div>
                        <div class="order-number">${order.orderNumber}</div>
                        <div style="color: #999; font-size: 13px; margin-top: 5px;">
                            ${new Date(order.createdAt).toLocaleDateString('en-US', { 
                                year: 'numeric', 
                                month: 'long', 
                                day: 'numeric' 
                            })}
                        </div>
                    </div>
                    <span class="order-status status-${order.status}">
                        ${order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                    </span>
                </div>
                <div class="order-details">
                    <div><strong>Items:</strong> ${order.items.length} item(s)</div>
                    <div><strong>Payment:</strong> ${order.paymentMethod.toUpperCase()} - ${order.paymentStatus}</div>
                    ${order.deliveryAddress ? `<div><strong>Delivery:</strong> ${order.deliveryAddress}, ${order.deliveryCity}</div>` : ''}
                </div>
                <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #e1e8ed;">
                    <strong>Order Items:</strong>
                    <ul style="margin-top: 10px; padding-left: 20px;">
                        ${order.items.map(item => `
                            <li style="margin-bottom: 5px;">
                                ${item.productName} x ${item.quantity} @ KSh ${item.productPrice} = KSh ${item.subtotal}
                            </li>
                        `).join('')}
                    </ul>
                </div>
                <div class="order-total">Total: KSh ${order.totalAmount.toLocaleString()}</div>
            </div>
        `).join('');
}

// Load user reviews
async function loadReviews() {
    const reviewsContent = document.getElementById('reviewsContent');
    const reviewsLoading = document.getElementById('reviewsLoading');
    
    try {
        if (IS_FILE_MODE) {
            const reviews = readJson('zion-local-reviews', []);
            reviewsLoading.style.display = 'none';
            reviewsContent.style.display = 'block';
            document.getElementById('totalReviews').textContent = reviews.length;
            reviewsContent.innerHTML = reviews.length ? reviews.map(review => `
                <div class="review-item">
                    <div class="review-header">
                        <div class="product-name">${review.productName || `Product ID: ${review.productId}`}</div>
                        <div class="rating-stars">${'★'.repeat(review.rating)}${'☆'.repeat(5 - review.rating)}</div>
                    </div>
                    ${review.comment ? `<div class="review-comment">${review.comment}</div>` : ''}
                    <div class="review-date">${new Date(review.createdAt || Date.now()).toLocaleDateString()}</div>
                </div>
            `).join('') : `
                <div class="empty-state">
                    <i class="fas fa-star"></i>
                    <h3>No Reviews Yet</h3>
                    <p>You haven't written any reviews yet.</p>
                    <a href="index.html" class="btn-primary"><i class="fas fa-shopping-cart"></i> Shop & Review</a>
                </div>
            `;
            return;
        }
        const response = await fetch(`${API_URL}/reviews/my-reviews`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to fetch reviews');
        }
        
        const data = await response.json();
        const reviews = data.reviews;
        
        reviewsLoading.style.display = 'none';
        reviewsContent.style.display = 'block';
        
        // Update stats
        document.getElementById('totalReviews').textContent = reviews.length;
        
        if (reviews.length === 0) {
            reviewsContent.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-star"></i>
                    <h3>No Reviews Yet</h3>
                    <p>You haven't written any reviews yet.</p>
                    <a href="index.html" class="btn-primary">
                        <i class="fas fa-shopping-cart"></i> Shop & Review
                    </a>
                </div>
            `;
            return;
        }
        
        // Display reviews
        reviewsContent.innerHTML = reviews.map(review => `
            <div class="review-item">
                <div class="review-header">
                    <div class="product-name">Product ID: ${review.productId}</div>
                    <div class="rating-stars">
                        ${'★'.repeat(review.rating)}${'☆'.repeat(5 - review.rating)}
                    </div>
                </div>
                ${review.comment ? `<div class="review-comment">${review.comment}</div>` : ''}
                <div class="review-date">
                    ${new Date(review.createdAt).toLocaleDateString('en-US', { 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                    })}
                </div>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('Error loading reviews:', error);
        reviewsLoading.style.display = 'none';
        reviewsContent.style.display = 'block';
        reviewsContent.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-triangle"></i>
                <h3>Error Loading Reviews</h3>
                <p>Unable to load your reviews. Please try again later.</p>
            </div>
        `;
    }
}

// Load user profile
async function loadProfile() {
    try {
        if (IS_FILE_MODE) {
            const user = currentUser || {};
            document.getElementById('profileName').value = user.fullName || '';
            document.getElementById('profileEmail').value = user.email || '';
            document.getElementById('profilePhone').value = user.phone || '';
            document.getElementById('profileCity').value = user.city || '';
            document.getElementById('profileAddress').value = user.address || '';
            return;
        }
        const response = await fetch(`${API_URL}/auth/profile`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to fetch profile');
        }
        
        const data = await response.json();
        const user = data.user;
        
        // Populate form
        document.getElementById('profileName').value = user.fullName || '';
        document.getElementById('profileEmail').value = user.email || '';
        document.getElementById('profilePhone').value = user.phone || '';
        document.getElementById('profileCity').value = user.city || '';
        document.getElementById('profileAddress').value = user.address || '';
        
    } catch (error) {
        console.error('Error loading profile:', error);
        showAlert('profileAlert', 'Failed to load profile data', 'error');
    }
}

// Update profile
document.getElementById('profileForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const updateBtn = document.getElementById('updateProfileBtn');
    const originalText = updateBtn.innerHTML;
    updateBtn.disabled = true;
    updateBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating...';
    
    try {
        const formData = {
            fullName: document.getElementById('profileName').value.trim(),
            phone: document.getElementById('profilePhone').value.trim(),
            city: document.getElementById('profileCity').value.trim(),
            address: document.getElementById('profileAddress').value.trim()
        };

        if (IS_FILE_MODE) {
            currentUser = { ...currentUser, ...formData };
            localStorage.setItem('user', JSON.stringify(currentUser));
            document.getElementById('userName').textContent = currentUser.fullName;
            showAlert('profileAlert', 'Local profile updated successfully!', 'success');
            return;
        }
        
        const response = await fetch(`${API_URL}/auth/profile`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });
        
        const data = await response.json();
        
        if (response.ok) {
            // Update local storage
            localStorage.setItem('user', JSON.stringify(data.user));
            currentUser = data.user;
            document.getElementById('userName').textContent = currentUser.fullName;
            
            showAlert('profileAlert', 'Profile updated successfully!', 'success');
        } else {
            showAlert('profileAlert', data.error || 'Failed to update profile', 'error');
        }
    } catch (error) {
        console.error('Error updating profile:', error);
        showAlert('profileAlert', 'Network error. Please try again.', 'error');
    } finally {
        updateBtn.disabled = false;
        updateBtn.innerHTML = originalText;
    }
});

// Show alert
function showAlert(elementId, message, type) {
    const alertBox = document.getElementById(elementId);
    alertBox.innerHTML = `
        <div class="alert alert-${type}">
            <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i>
            ${message}
        </div>
    `;
    setTimeout(() => alertBox.innerHTML = '', 5000);
}

// Tab switching
document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
        // Remove active class from all tabs and contents
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        
        // Add active class to clicked tab and corresponding content
        tab.classList.add('active');
        const tabName = tab.getAttribute('data-tab');
        document.getElementById(`${tabName}Tab`).classList.add('active');
    });
});

// Logout
document.getElementById('logoutBtn').addEventListener('click', () => {
    if (confirm('Are you sure you want to logout?')) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = 'index.html';
    }
});

// Initialize on page load
window.addEventListener('DOMContentLoaded', initDashboard);
