// ===== Zion Groceries - Main Application =====

// Supabase Configuration
const SUPABASE_URL = 'https://oadqqddauhmgunibwzls.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9hZHFxZGRhdWhtZ3VuaWJ3emxzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkzMzIxNDgsImV4cCI6MjA4NDkwODE0OH0.ANp4tmeBlL8DQCDE3LsqhpdSQtbOFoVp6iTxCH5Zfew';

// Configuration
const CONFIG = {
    whatsappNumber: '254745562238',
    mpesaPayNumber: '0745562238',
    currency: 'KSh'
};

const IS_FILE_MODE = window.location.protocol === 'file:';
const API_URL = window.location.hostname === 'localhost'
    ? `${window.location.origin}/api`
    : '/api';
const PRODUCTS_CATALOG_URL = IS_FILE_MODE ? 'products-catalog.json' : '/products-catalog.json';
function localPage(page) {
    return IS_FILE_MODE ? page : `/${page}`;
}

function cacheBustedUrl(url) {
    if (IS_FILE_MODE) return url;
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}v=${Date.now()}`;
}

// Authentication state
let currentUser = null;
let authToken = null;

// Check if user is logged in
function checkAuth() {
    authToken = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    
    if (authToken && userStr) {
        currentUser = JSON.parse(userStr);
        updateUIForLoggedInUser();
        return true;
    }
    return false;
}

// Update UI for logged in user
function updateUIForLoggedInUser() {
    // Add user menu to header
    const headerActions = document.querySelector('.header-actions');
    if (headerActions && !document.getElementById('userMenu')) {
        const userMenuHTML = `
            <div id="userMenu" style="display: flex; align-items: center; gap: 10px; margin-right: 15px;">
                <a href="dashboard.html" style="color: white; text-decoration: none; font-size: 14px;">
                    <i class="fas fa-user-circle"></i> ${currentUser.fullName}
                </a>
                <button id="logoutBtnMain" style="background: rgba(255,255,255,0.2); color: white; border: none; padding: 8px 15px; border-radius: 5px; cursor: pointer; font-size: 14px;">
                    <i class="fas fa-sign-out-alt"></i> Logout
                </button>
            </div>
        `;
        headerActions.insertAdjacentHTML('afterbegin', userMenuHTML);
        
        document.getElementById('logoutBtnMain').addEventListener('click', () => {
            if (confirm('Are you sure you want to logout?')) {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                window.location.reload();
            }
        });
    }
}

// Static fallback is kept in sync with data/products.json
const PRODUCTS_DATA = Array.isArray(window.ZION_PRODUCTS_CATALOG) ? window.ZION_PRODUCTS_CATALOG : [];

// State
let products = [];
let cart = readStoredJson('zionCart', []);
let currentCategory = 'all';

const DEPARTMENT_LABELS = {
    all: 'All',
    produce: 'Fresh Produce',
    vegetables: 'Fresh Produce',
    fruits: 'Fresh Produce',
    dairy: 'Dairy',
    staples: 'Staples',
    bakery: 'Bakery',
    chicken: 'Chicken',
    beverages: 'Drinks',
    snacks: 'Snacks'
};

function sortProductsByName(list) {
    return [...list].sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), undefined, { sensitivity: 'base' }));
}

function productKey(product) {
    return product?.id ? `id:${product.id}` : `name:${String(product?.name || '').toLowerCase()}`;
}

function sortProductsByCatalogOrder(list, catalog = PRODUCTS_DATA) {
    const catalogOrder = new Map(catalog.map((product, index) => [productKey(product), index]));
    const catalogLength = catalog.length;
    return [...list].sort((a, b) => {
        const aOrder = catalogOrder.has(productKey(a)) ? catalogOrder.get(productKey(a)) : catalogLength;
        const bOrder = catalogOrder.has(productKey(b)) ? catalogOrder.get(productKey(b)) : catalogLength;
        if (aOrder !== bOrder) return aOrder - bOrder;
        return String(a.name || '').localeCompare(String(b.name || ''), undefined, { sensitivity: 'base' });
    });
}

function mergeProducts(primary = [], fallback = PRODUCTS_DATA) {
    const merged = new Map();
    [...primary, ...fallback].forEach((product) => {
        if (!product || !product.name) return;
        merged.set(productKey(product), product);
    });
    return sortProductsByCatalogOrder(
        [...merged.values()].filter(product => product.isActive !== false && Number(product.stock ?? 1) > 0),
        fallback
    );
}

function getDepartmentLabel(category) {
    return DEPARTMENT_LABELS[String(category || '').toLowerCase()] || String(category || 'Essentials');
}

function productMatchesCategory(product, category) {
    if (!category || category === 'all') return true;
    const productCategory = String(product.category || '').toLowerCase();
    if (category === 'produce') return productCategory === 'vegetables' || productCategory === 'fruits';
    return productCategory === category;
}

// DOM Elements
const productsGrid = document.getElementById('productsGrid');
const loading = document.getElementById('loading');
const noProducts = document.getElementById('noProducts');
const cartBtn = document.getElementById('cartBtn');
const cartSidebar = document.getElementById('cartSidebar');
const cartOverlay = document.getElementById('cartOverlay');
const closeCart = document.getElementById('closeCart');
const cartItems = document.getElementById('cartItems');
const cartEmpty = document.getElementById('cartEmpty');
const cartFooter = document.getElementById('cartFooter');
const cartCount = document.getElementById('cartCount');
const cartTotal = document.getElementById('cartTotal');
const orderWhatsApp = document.getElementById('orderWhatsApp');
const clearCartBtn = document.getElementById('clearCart');
const searchInput = document.getElementById('searchInput');
const navLinks = document.querySelectorAll('.nav-link');
const toast = document.getElementById('toast');
const toastMessage = document.getElementById('toastMessage');
const shopAgent = document.getElementById('shopAgent');
const shopAgentToggle = document.getElementById('shopAgentToggle');
const shopAgentClose = document.getElementById('shopAgentClose');
const shopAgentMessages = document.getElementById('shopAgentMessages');
const shopAgentForm = document.getElementById('shopAgentForm');
const shopAgentInput = document.getElementById('shopAgentInput');
const shopAgentVoice = document.getElementById('shopAgentVoice');
const shopAgentStatus = document.getElementById('shopAgentStatus');

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let shopAgentRecognition = null;
let shopAgentListening = false;
let shopAgentWelcomed = false;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    checkAuth(); // Check authentication status
    fetchProducts();
    updateCartUI();
    setupEventListeners();
});

// Fetch products from local server, Supabase, or fallback
async function fetchProducts() {
    try {
        renderSkeletons();

        if (IS_FILE_MODE) {
            const adminProducts = readStoredJson('zion-admin-products', []);
            if (adminProducts.length > 0) {
                products = sortProductsByCatalogOrder(adminProducts.filter(product => product.isActive !== false));
                renderProducts();
                return;
            }
        }
        
        if (!IS_FILE_MODE) {
            // Try server API first when the page is served over HTTP.
            try {
                const response = await fetch(cacheBustedUrl(`${API_URL}/products`), { cache: 'no-store' });
                if (response.ok) {
                    const data = await response.json();
                    if (data && data.length > 0) {
                        products = mergeProducts(data, PRODUCTS_DATA);
                        renderProducts();
                        return;
                    }
                }
            } catch (fetchError) {
                console.log('Server API not available, using fallback data...');
            }
        }
        
        // Use the generated static catalog fallback as last resort
        const fallbackResponse = await fetch(cacheBustedUrl(PRODUCTS_CATALOG_URL), { cache: 'no-store' });
        if (!fallbackResponse.ok) {
            throw new Error('Static product catalog is unavailable');
        }

        const fallbackData = await fallbackResponse.json();
        console.log('Using static fallback products data');
        products = mergeProducts(Array.isArray(fallbackData) ? fallbackData : PRODUCTS_DATA);
        renderProducts();
    } catch (error) {
        console.error('Error loading products:', error);
        products = mergeProducts(PRODUCTS_DATA);
        renderProducts();
    }
}

function readStoredJson(key, fallback = []) {
    try {
        const rawValue = localStorage.getItem(key);
        if (!rawValue) return fallback;
        const parsed = JSON.parse(rawValue);
        return Array.isArray(fallback) ? (Array.isArray(parsed) ? parsed : fallback) : (parsed ?? fallback);
    } catch (error) {
        console.warn(`Ignoring invalid localStorage value for ${key}`, error);
        localStorage.removeItem(key);
        return fallback;
    }
}

function normalizeId(value) {
    return String(value);
}

function renderSkeletons() {
    productsGrid.innerHTML = Array(8).fill(0).map(() => `
        <div class="product-card skeleton-card">
            <div class="product-image skeleton"></div>
            <div class="product-info">
                <div class="skeleton" style="height: 20px; width: 70%; margin-bottom: 10px;"></div>
                <div class="skeleton" style="height: 15px; width: 90%; margin-bottom: 20px;"></div>
                <div class="skeleton" style="height: 25px; width: 40%; margin-bottom: 25px;"></div>
                <div class="product-actions">
                    <div class="skeleton" style="height: 40px; width: 100px;"></div>
                    <div class="skeleton" style="height: 40px; flex: 1;"></div>
                </div>
            </div>
        </div>
    `).join('');
}

// Render products
function renderProducts(productsToRender = products) {
    let filtered = sortProductsByCatalogOrder(productsToRender);
    
    // Filter by category
    if (currentCategory && currentCategory !== 'all') {
        filtered = filtered.filter(p => productMatchesCategory(p, currentCategory));
    }
    
    // Filter by search
    const searchTerm = searchInput?.value?.toLowerCase().trim();
    if (searchTerm) {
        filtered = filtered.filter(p => 
            p.name.toLowerCase().includes(searchTerm) || 
            (p.description && p.description.toLowerCase().includes(searchTerm))
        );
    }
    
    noProducts.style.display = filtered.length === 0 ? 'block' : 'none';
    productsGrid.style.display = filtered.length === 0 ? 'none' : 'grid';
    if (loading) {
        loading.style.display = 'none';
    }
    
    productsGrid.innerHTML = filtered.map(product => {
        const productImage = product.image || `https://placehold.co/300x200/10b981/ffffff?text=${encodeURIComponent(product.name || 'Product')}`;
        const department = getDepartmentLabel(product.category);
        const stock = Number(product.stock ?? 0);
        const stockLabel = stock > 0 ? `${stock.toLocaleString()} available` : 'Restocking';
        const description = product.description || `${department} item for Crotonridge delivery.`;
        return `
            <div class="product-card reveal" data-id="${product.id}">
                <div class="product-image">
                    <img src="${productImage}" alt="${product.name}" loading="lazy" onerror="this.onerror=null; this.src='https://placehold.co/300x200/10b981/ffffff?text=${encodeURIComponent(product.name || 'Product')}'">
                    <span class="product-category">${department}</span>
                    <span class="product-stock ${stock > 0 ? 'in-stock' : 'out-stock'}">${stockLabel}</span>
                </div>
                <div class="product-info">
                    <div class="product-copy">
                        <h3 class="product-name">${product.name}</h3>
                        <p class="product-description">${description}</p>
                    </div>
                    <div class="product-meta-row">
                        <span><i class="fas fa-store"></i> ${department}</span>
                        <span><i class="fas fa-scale-balanced"></i> ${product.unit}</span>
                    </div>
                    <div class="product-buy-row">
                        <div class="product-price">
                            <small>${CONFIG.currency}</small>${Number(product.price).toLocaleString()} <span>/ ${product.unit}</span>
                        </div>
                        <div class="quantity-control" aria-label="Quantity for ${product.name}">
                            <button onclick="decrementQuantity(${product.id})" aria-label="Reduce ${product.name} quantity"><i class="fas fa-minus"></i></button>
                            <input type="number" id="qty-${product.id}" value="1" min="1" max="${product.stock}" aria-label="${product.name} quantity">
                            <button onclick="incrementQuantity(${product.id})" aria-label="Increase ${product.name} quantity"><i class="fas fa-plus"></i></button>
                        </div>
                    </div>
                    <button class="add-to-cart" onclick="addToCart(${product.id})">
                        <i class="fas fa-basket-shopping"></i> Add to basket
                    </button>
                </div>
            </div>
        `;
    }).join('');

    initializeRevealAnimations();
}

function incrementQuantity(productId) {
    const input = document.getElementById(`qty-${productId}`);
    const max = parseInt(input.max);
    const current = parseInt(input.value);
    if (current < max) input.value = current + 1;
}

function decrementQuantity(productId) {
    const input = document.getElementById(`qty-${productId}`);
    const current = parseInt(input.value);
    if (current > 1) input.value = current - 1;
}

function addToCart(productId) {
    const product = products.find(p => normalizeId(p.id) === normalizeId(productId));
    if (!product) return;
    
    const quantityInput = document.getElementById(`qty-${productId}`);
    const quantity = parseInt(quantityInput.value) || 1;

    addProductToCart(product, quantity);
    showToast(`${product.name} added to cart!`);
    quantityInput.value = 1;
}

function addProductToCart(product, quantity = 1) {
    const safeQuantity = Math.max(1, parseInt(quantity, 10) || 1);
    const existingItem = cart.find(item => normalizeId(item.id) === normalizeId(product.id));

    if (existingItem) {
        existingItem.quantity += safeQuantity;
    } else {
        cart.push({
            id: product.id,
            name: product.name,
            price: Number(product.price),
            unit: product.unit,
            image: product.image,
            quantity: safeQuantity
        });
    }

    saveCart();
    updateCartUI();
}

function removeFromCart(productId) {
    cart = cart.filter(item => normalizeId(item.id) !== normalizeId(productId));
    saveCart();
    updateCartUI();
    showToast('Item removed from cart');
}

function updateCartItemQuantity(productId, change) {
    const item = cart.find(item => normalizeId(item.id) === normalizeId(productId));
    if (!item) return;
    item.quantity += change;
    if (item.quantity <= 0) {
        removeFromCart(productId);
        return;
    }
    saveCart();
    updateCartUI();
}

function saveCart() {
    localStorage.setItem('zionCart', JSON.stringify(cart));
}

function bindClick(element, handler) {
    if (element) {
        element.addEventListener('click', handler);
    }
}

function updateCartUI() {
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    cartCount.textContent = totalItems;
    
    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const deliveryProgress = cart.length ? 100 : 0;
    
    const promoText = document.getElementById('promoText');
    const promoProgress = document.getElementById('promoProgress');
    if (promoText && promoProgress) {
        promoText.innerHTML = '<i class="fas fa-location-dot" style="color: var(--primary);"></i> <strong>KSh 40 delivery</strong> inside Crotonridge. Section, road and lane are collected at checkout.';
        promoProgress.style.width = `${deliveryProgress}%`;
        promoProgress.style.background = 'var(--primary)';
    }
    
    if (cart.length === 0) {
        cartItems.style.display = 'none';
        cartEmpty.classList.add('active');
        cartFooter.style.display = 'none';
    } else {
        cartItems.style.display = 'block';
        cartEmpty.classList.remove('active');
        cartFooter.style.display = 'block';
        
        cartItems.innerHTML = cart.map(item => `
            <div class="cart-item">
                <div class="cart-item-image">
                    <img src="${item.image}" alt="${item.name}" loading="lazy" crossorigin="anonymous" onerror="this.onerror=null; this.src='https://placehold.co/70x70/10b981/ffffff?text=${encodeURIComponent(item.name.substring(0,3))}'">
                </div>
                <div class="cart-item-details">
                    <div class="cart-item-name">${item.name}</div>
                    <div class="cart-item-price">${CONFIG.currency} ${item.price.toLocaleString()} / ${item.unit}</div>
                    <div class="cart-item-quantity">
                        <button onclick="updateCartItemQuantity(${item.id}, -1)">-</button>
                        <span>${item.quantity}</span>
                        <button onclick="updateCartItemQuantity(${item.id}, 1)">+</button>
                    </div>
                </div>
                <button class="cart-item-remove" onclick="removeFromCart(${item.id})">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `).join('');
        
        cartTotal.textContent = `${CONFIG.currency} ${total.toLocaleString()}`;
    }
}

function openCart() {
    cartSidebar.classList.add('active');
    cartOverlay.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeCartSidebar() {
    cartSidebar.classList.remove('active');
    cartOverlay.classList.remove('active');
    document.body.style.overflow = '';
}

function clearCart() {
    if (cart.length === 0) return;
    if (confirm('Are you sure you want to clear your cart?')) {
        cart = [];
        saveCart();
        updateCartUI();
        showToast('Cart cleared');
    }
}

function sendWhatsAppOrder() {
    if (cart.length === 0) {
        showToast('Your cart is empty!');
        return;
    }

    closeCartSidebar();
    window.location.href = localPage('checkout.html');
}

// Show order method selection modal
function showOrderMethodModal() {
    const modal = document.createElement('div');
    modal.className = 'order-modal';
    modal.innerHTML = `
        <div class="order-modal-overlay"></div>
        <div class="order-modal-content">
            <div class="order-modal-header">
                <h2>📦 Choose Order Method</h2>
                <button class="order-modal-close" onclick="closeOrderModal()">&times;</button>
            </div>
            <div class="order-modal-body">
                <p style="color: #6b7280; margin-bottom: 20px; text-align: center;">How would you like to place your order?</p>
                
                <div class="order-method-options">
                    <button class="order-method-btn" onclick="closeOrderModal(); window.location.href=localPage('checkout.html')">
                        <div class="method-icon">🛒</div>
                        <div class="method-content">
                            <h3>Order Online</h3>
                            <p>Complete checkout and pay directly</p>
                            <span class="method-badge recommended">Recommended</span>
                        </div>
                        <i class="fas fa-arrow-right"></i>
                    </button>
                    
                    <button class="order-method-btn" onclick="closeOrderModal(); showOrderDetailsModal()">
                        <div class="method-icon">💬</div>
                        <div class="method-content">
                            <h3>Order via WhatsApp</h3>
                            <p>Send order details to our WhatsApp</p>
                        </div>
                        <i class="fas fa-arrow-right"></i>
                    </button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    setTimeout(() => modal.classList.add('show'), 10);
    window.currentOrderModal = modal;
}

// Show online checkout modal
function showOnlineCheckout() {
    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);
    const savedName = localStorage.getItem('customerName') || '';
    const savedPhone = localStorage.getItem('customerPhone') || '';
    const savedSection = localStorage.getItem('crotonSection') || localStorage.getItem('hostel') || '';
    const savedRoad = localStorage.getItem('crotonRoad') || '';
    const savedLane = localStorage.getItem('crotonLane') || localStorage.getItem('room') || '';
    
    const modal = document.createElement('div');
    modal.className = 'order-modal';
    modal.innerHTML = `
        <div class="order-modal-overlay"></div>
        <div class="order-modal-content" style="max-width: 700px;">
            <div class="order-modal-header">
                <h2>🛒 Checkout</h2>
                <button class="order-modal-close" onclick="closeOrderModal()">&times;</button>
            </div>
            <div class="order-modal-body">
                <!-- Order Summary -->
                <div class="checkout-summary">
                    <h3 style="margin-bottom: 15px; color: #1f2937;">📦 Order Summary</h3>
                    <div class="checkout-items">
                        ${cart.map(item => `
                            <div class="checkout-item">
                                <div class="checkout-item-info">
                                    <span class="item-name">${item.name}</span>
                                    <span class="item-qty">x${item.quantity}</span>
                                </div>
                                <span class="item-price">KSh ${(item.price * item.quantity).toLocaleString()}</span>
                            </div>
                        `).join('')}
                    </div>
                    <div class="checkout-total">
                        <span>Total (${itemCount} items):</span>
                        <span class="total-amount">KSh ${total.toLocaleString()}</span>
                    </div>
                </div>

                <!-- Delivery Information -->
                <div class="checkout-section">
                    <h3>📍 Delivery Information</h3>
                    <div class="form-group">
                        <label for="checkoutName">Full Name *</label>
                        <input type="text" id="checkoutName" placeholder="John Doe" value="${savedName}" required>
                    </div>
                    <div class="form-group">
                        <label for="checkoutPhone">Phone Number *</label>
                        <input type="tel" id="checkoutPhone" placeholder="0712345678" value="${savedPhone}" required>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label for="checkoutSection">Section *</label>
                            <input type="text" id="checkoutSection" placeholder="Section A" value="${savedSection}" required>
                        </div>
                        <div class="form-group">
                            <label for="checkoutRoad">Road *</label>
                            <input type="text" id="checkoutRoad" placeholder="Ridge Road" value="${savedRoad}" required>
                        </div>
                    </div>
                    <div class="form-group">
                        <label for="checkoutLane">Lane *</label>
                        <input type="text" id="checkoutLane" placeholder="Lane 4" value="${savedLane}" required>
                    </div>
                    <div class="form-group">
                        <label for="checkoutNotes">Delivery Notes (Optional)</label>
                        <textarea id="checkoutNotes" rows="2" placeholder="House number, gate color, landmark, or preferred delivery time"></textarea>
                    </div>
                </div>

                <!-- Payment Method -->
                <div class="checkout-section">
                    <h3>💳 Payment Method</h3>
                    <div class="payment-options">
                        <label class="payment-option">
                            <input type="radio" name="payment" value="mpesa" checked>
                            <div class="payment-content">
                                <div class="payment-icon">📱</div>
                                <div>
                                    <strong>M-Pesa</strong>
                                    <p>Pay via M-Pesa before delivery</p>
                                </div>
                            </div>
                            <i class="fas fa-check-circle"></i>
                        </label>
                        <label class="payment-option">
                            <input type="radio" name="payment" value="cod">
                            <div class="payment-content">
                                <div class="payment-icon">💵</div>
                                <div>
                                    <strong>Cash on Delivery</strong>
                                    <p>Pay when you receive your order</p>
                                </div>
                            </div>
                            <i class="fas fa-check-circle"></i>
                        </label>
                    </div>
                </div>

                <!-- Place Order Button -->
                <button class="submit-order-btn" onclick="submitOnlineOrder()">
                    <i class="fas fa-check-circle"></i> Place Order - KSh ${total.toLocaleString()}
                </button>

                <p style="text-align: center; color: #6b7280; font-size: 0.85rem; margin-top: 15px;">
                    By placing this order, you agree to our terms and conditions
                </p>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    setTimeout(() => modal.classList.add('show'), 10);
    window.currentOrderModal = modal;
}

function showOrderDetailsModal() {
    const modal = document.createElement('div');
    modal.className = 'order-modal';
    modal.innerHTML = `
        <div class="order-modal-overlay"></div>
        <div class="order-modal-content">
            <div class="order-modal-header">
                <h2>📍 Delivery Information</h2>
                <button class="order-modal-close" onclick="closeOrderModal()">&times;</button>
            </div>
            <div class="order-modal-body">
                <p style="color: #6b7280; margin-bottom: 20px;">Please provide your delivery details to complete your order:</p>
                
                <div class="form-group">
                    <label for="customerSection">Section *</label>
                    <input type="text" id="customerSection" placeholder="e.g., Section A" required>
                </div>
                
                <div class="form-group">
                    <label for="customerRoad">Road *</label>
                    <input type="text" id="customerRoad" placeholder="e.g., Ridge Road" required>
                </div>
                
                <div class="form-group">
                    <label for="customerLane">Lane *</label>
                    <input type="text" id="customerLane" placeholder="e.g., Lane 4" required>
                </div>
                
                <div class="form-group">
                    <label for="customerPhone">📱 Your Phone Number *</label>
                    <input type="tel" id="customerPhone" placeholder="e.g., 0712345678" required>
                </div>
                
                <div class="form-group">
                    <label for="customerName">👤 Your Name (Optional)</label>
                    <input type="text" id="customerName" placeholder="Your full name">
                </div>
                
                <div class="form-group">
                    <label for="deliveryNotes">📝 Additional Notes (Optional)</label>
                    <textarea id="deliveryNotes" rows="2" placeholder="Any special instructions for delivery..."></textarea>
                </div>
                
                <button class="submit-order-btn" onclick="submitWhatsAppOrder()">
                    <i class="fas fa-paper-plane"></i> Send Order via WhatsApp
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    
    // Animate in
    setTimeout(() => modal.classList.add('show'), 10);
    
    // Store reference
    window.currentOrderModal = modal;
}

function closeOrderModal() {
    const modal = window.currentOrderModal;
    if (modal) {
        modal.classList.remove('show');
        setTimeout(() => modal.remove(), 300);
        window.currentOrderModal = null;
    }
}

function submitWhatsAppOrder() {
    const section = document.getElementById('customerSection').value.trim();
    const road = document.getElementById('customerRoad').value.trim();
    const lane = document.getElementById('customerLane').value.trim();
    const customerPhone = document.getElementById('customerPhone').value.trim();
    const customerName = document.getElementById('customerName').value.trim();
    const deliveryNotes = document.getElementById('deliveryNotes').value.trim();
    
    // Validation
    if (!section) {
        showToast('Please enter your section');
        document.getElementById('customerSection').focus();
        return;
    }
    
    if (!road) {
        showToast('Please enter your road');
        document.getElementById('customerRoad').focus();
        return;
    }
    
    if (!lane) {
        showToast('Please enter your lane');
        document.getElementById('customerLane').focus();
        return;
    }
    
    if (!customerPhone) {
        showToast('❌ Please enter your phone number');
        document.getElementById('customerPhone').focus();
        return;
    }
    
    // Validate phone number format (basic)
    const phoneRegex = /^(0|\+254)[17]\d{8}$/;
    if (!phoneRegex.test(customerPhone.replace(/\s/g, ''))) {
        showToast('❌ Please enter a valid phone number (e.g., 0712345678)');
        document.getElementById('customerPhone').focus();
        return;
    }
    
    // Build WhatsApp message
    let message = '🛒 *New Order from Zion Groceries*\\n\\n';
    message += '👤 *Customer Information:*\\n';
    if (customerName) message += `Name: ${customerName}\\n`;
    message += `📱 Phone: ${customerPhone}\\n`;
    message += `Estate: Crotonridge Estate\\n`;
    message += `Section: ${section}\\n`;
    message += `Road: ${road}\\n`;
    message += `Lane: ${lane}\\n`;
    if (deliveryNotes) message += `📝 Notes: ${deliveryNotes}\\n`;
    message += '\\n📦 *Order Details:*\\n─────────────────\\n';
    
    cart.forEach((item, index) => {
        const subtotal = item.price * item.quantity;
        message += `${index + 1}. ${item.name}\\n   Qty: ${item.quantity} × ${CONFIG.currency} ${item.price.toLocaleString()}\\n   Subtotal: ${CONFIG.currency} ${subtotal.toLocaleString()}\\n\\n`;
    });
    
    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);
    
    message += `─────────────────\\n💰 *Total Amount: ${CONFIG.currency} ${total.toLocaleString()}*\\n\\n`;
    message += '✅ Thank you for your order! We will deliver soon. 🥬🍎';
    
    const encodedMessage = encodeURIComponent(message);
    
    // Open WhatsApp
    window.open(`https://wa.me/${CONFIG.whatsappNumber}?text=${encodedMessage}`, '_blank');
    
    // Close modal and show success
    closeOrderModal();
    showToast('✅ Order sent! We will respond shortly.');
    showAutoReplyNotification();
    
    // Redirect to confirmation page
    setTimeout(() => {
        const confirmUrl = `${localPage('order-confirmation.html')}?name=${encodeURIComponent(customerName || 'Customer')}&phone=${encodeURIComponent(customerPhone)}&section=${encodeURIComponent(section)}&road=${encodeURIComponent(road)}&lane=${encodeURIComponent(lane)}&items=${itemCount}&total=${total}&payment=whatsapp&source=whatsapp`;
        window.location.href = confirmUrl;
    }, 1500);
    
    // Optionally clear cart after successful order
    // setTimeout(() => clearCart(), 2000);
}

// Submit online order (no WhatsApp)
async function submitOnlineOrder() {
    const name = document.getElementById('checkoutName').value.trim();
    const phone = document.getElementById('checkoutPhone').value.trim();
    const section = document.getElementById('checkoutSection').value.trim();
    const road = document.getElementById('checkoutRoad').value.trim();
    const lane = document.getElementById('checkoutLane').value.trim();
    const notes = document.getElementById('checkoutNotes').value.trim();
    const paymentMethod = document.querySelector('input[name="payment"]:checked').value;
    
    // Validation
    if (!name) {
        showToast('❌ Please enter your name');
        document.getElementById('checkoutName').focus();
        return;
    }
    
    if (!phone) {
        showToast('❌ Please enter your phone number');
        document.getElementById('checkoutPhone').focus();
        return;
    }
    
    const phoneRegex = /^(0|\+254)[17]\d{8}$/;
    if (!phoneRegex.test(phone.replace(/\s/g, ''))) {
        showToast('❌ Please enter a valid phone number');
        document.getElementById('checkoutPhone').focus();
        return;
    }
    
    if (!section) {
        showToast('Please enter your section');
        document.getElementById('checkoutSection').focus();
        return;
    }
    
    if (!road) {
        showToast('Please enter your road');
        document.getElementById('checkoutRoad').focus();
        return;
    }
    
    if (!lane) {
        showToast('Please enter your lane');
        document.getElementById('checkoutLane').focus();
        return;
    }
    
    // Calculate totals
    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);
    const estate = 'Crotonridge Estate';
    const deliveryAddress = `${estate}, ${section}`;
    const deliveryNotes = [`Road: ${road}`, `Lane: ${lane}`, notes].filter(Boolean).join(' | ');
    
    const token = localStorage.getItem('token');
    const orderPayload = {
        items: cart.map((item) => ({
            productId: item.id,
            quantity: item.quantity
        })),
        deliveryAddress,
        deliveryCity: road,
        deliveryRoom: lane,
        customerName: name,
        customerPhone: phone,
        notes: deliveryNotes,
        paymentMethod,
        deliveryFee: 40,
        estimatedDeliveryMinutes: 30,
        subtotalAmount: total
    };

    try {
        if (IS_FILE_MODE) {
            const now = new Date().toISOString();
            const orderId = `LOCAL-${Date.now()}`;
            const order = {
                id: orderId,
                orderNumber: orderId,
                date: now,
                createdAt: now,
                status: 'pending',
                items: cart.map(item => ({
                    id: item.id,
                    productId: item.id,
                    name: item.name,
                    qty: item.quantity,
                    quantity: item.quantity,
                    price: item.price,
                    productPrice: item.price,
                    unit: item.unit,
                    image: item.image,
                    emoji: getProductEmoji(item.name)
                })),
                deliveryFee: 40,
                estimatedDeliveryMinutes: 30,
                total: total + 40,
                totalAmount: total + 40,
                customer: { name, phone, estate, section, road, lane, notes },
                userName: name,
                customerPhone: phone,
                deliveryAddress,
                deliveryCity: road,
                deliveryRoom: lane,
                notes: deliveryNotes,
                paymentMethod,
                paymentStatus: paymentMethod === 'mpesa' ? 'pending' : 'cash_on_delivery',
                tracking: generateOrderTracking('pending')
            };
            const receipt = { orderId, createdAt: now, customer: order.customer, paymentMethod, paymentStatus: order.paymentStatus, paymentReference: '', deliveryFee: 40, estimatedDeliveryMinutes: 30, subtotal: total, total: total + 40, items: order.items };
            let orders = JSON.parse(localStorage.getItem('g-man-orders') || '[]');
            orders = [order, ...orders.filter((existing) => existing.id !== order.id)];
            localStorage.setItem('g-man-orders', JSON.stringify(orders));
            localStorage.setItem('zion-orders', JSON.stringify(orders));
            localStorage.setItem('lastOrderId', order.id);
            localStorage.setItem('lastOrderReceipt', JSON.stringify(receipt));
            localStorage.setItem('customerName', name);
            localStorage.setItem('customerPhone', phone);
            localStorage.setItem('crotonSection', section);
            localStorage.setItem('crotonRoad', road);
            localStorage.setItem('crotonLane', lane);
            localStorage.setItem('hostel', section);
            localStorage.setItem('room', lane);
            closeOrderModal();
            cart = [];
            saveCart();
            updateCartUI();
            showToast('✅ Order saved locally!');
            setTimeout(() => {
                window.location.href = `${localPage('order-confirmation.html')}?orderId=${encodeURIComponent(order.id)}&name=${encodeURIComponent(name)}&phone=${encodeURIComponent(phone)}&section=${encodeURIComponent(section)}&road=${encodeURIComponent(road)}&lane=${encodeURIComponent(lane)}&items=${itemCount}&total=${receipt.total}&payment=${encodeURIComponent(paymentMethod)}&deliveryFee=40&eta=30`;
            }, 1000);
            return;
        }

        const response = await fetch(`${API_URL}/orders`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            },
            body: JSON.stringify(orderPayload)
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || 'Failed to place order');
        }

        const serverOrder = data.order;
        const order = {
            id: serverOrder.orderNumber || `ORD-${serverOrder.id}`,
            backendId: serverOrder.id,
            date: serverOrder.createdAt || new Date().toISOString(),
            status: serverOrder.status,
            items: cart.map(item => ({
                id: item.id,
                name: item.name,
                qty: item.quantity,
                price: item.price,
                unit: item.unit,
                image: item.image,
                emoji: getProductEmoji(item.name)
            })),
            total: serverOrder.totalAmount ?? total,
            deliveryFee: serverOrder.deliveryFee ?? 40,
            estimatedDeliveryMinutes: serverOrder.estimatedDeliveryMinutes ?? 30,
            deliveryAddress,
            deliveryCity: road,
            deliveryRoom: lane,
            customer: {
                name,
                phone,
                estate,
                section,
                road,
                lane,
                notes
            },
            paymentMethod,
            paymentStatus: serverOrder.paymentStatus || (paymentMethod === 'mpesa' ? 'pending' : 'cash_on_delivery'),
            tracking: generateOrderTracking(serverOrder.status)
        };

        let orders = JSON.parse(localStorage.getItem('g-man-orders') || '[]');
        orders = [order, ...orders.filter((existing) => existing.id !== order.id)];
        localStorage.setItem('g-man-orders', JSON.stringify(orders));
        localStorage.setItem('zion-orders', JSON.stringify(orders));
        localStorage.setItem('lastOrderId', order.id);
        localStorage.setItem('lastOrderReceipt', JSON.stringify({ orderId: order.id, createdAt: order.date, customer: order.customer, paymentMethod, paymentStatus: order.paymentStatus, paymentReference: serverOrder.paymentReference || '', deliveryFee: Number(order.deliveryFee || 0), estimatedDeliveryMinutes: Number(order.estimatedDeliveryMinutes || 0), subtotal: total, total: Number(order.total), items: order.items }));

        localStorage.setItem('customerName', name);
        localStorage.setItem('customerPhone', phone);
        localStorage.setItem('crotonSection', section);
        localStorage.setItem('crotonRoad', road);
        localStorage.setItem('crotonLane', lane);
        localStorage.setItem('hostel', section);
        localStorage.setItem('room', lane);

        closeOrderModal();

        if (paymentMethod === 'mpesa') {
            showMpesaInstructions(order);
        } else {
            showToast('✅ Order placed successfully!');
            setTimeout(() => {
                const confirmUrl = `${localPage('order-confirmation.html')}?orderId=${encodeURIComponent(order.id)}&name=${encodeURIComponent(name)}&phone=${encodeURIComponent(phone)}&section=${encodeURIComponent(section)}&road=${encodeURIComponent(road)}&lane=${encodeURIComponent(lane)}&items=${itemCount}&total=${order.total}&payment=${encodeURIComponent(paymentMethod)}`;
                window.location.href = confirmUrl;
            }, 1500);
        }

        cart = [];
        saveCart();
        updateCartUI();
        sendOrderNotification(order);
    } catch (error) {
        console.error('Order submission error:', error);
        showToast(`❌ ${error.message || 'Failed to place order'}`);
    }
}

// Show M-Pesa payment instructions
function showMpesaInstructions(order) {
    const mpesaPhoneDisplay = CONFIG.mpesaPayNumber;
    const modal = document.createElement('div');
    modal.className = 'order-modal';
    modal.innerHTML = `
        <div class="order-modal-overlay"></div>
        <div class="order-modal-content">
            <div class="order-modal-header" style="background: #10b981;">
                <h2>📱 M-Pesa Payment</h2>
            </div>
            <div class="order-modal-body">
                <div style="text-align: center; padding: 20px;">
                    <div style="font-size: 60px; margin-bottom: 20px;">💳</div>
                    <h3 style="margin-bottom: 15px;">Complete Your Payment</h3>
                    <p style="color: #6b7280; margin-bottom: 25px;">Follow these steps to pay via M-Pesa</p>
                </div>

                <div style="background: #f3f4f6; padding: 20px; border-radius: 12px; margin-bottom: 20px;">
                    <div style="font-size: 0.9rem; color: #374151; line-height: 1.8;">
                        <p style="text-align: center; margin-bottom: 15px;"><strong>Send payment to the M-Pesa number below</strong></p>
                        <p><strong>Amount to Pay:</strong> <strong style="color: #10b981; font-size: 1.3rem;">KSh ${order.total.toLocaleString()}</strong></p>
                        <p><strong>M-Pesa Number:</strong> <span style="font-size: 1.15rem; font-weight: 700; color: #111827;">${mpesaPhoneDisplay}</span></p>
                        <p><strong>Reference:</strong> <span style="font-weight: 700;">${order.id}</span></p>
                        <div style="text-align: center; margin-top: 20px;">
                            <a href="https://wa.me/${CONFIG.whatsappNumber}?text=Hi!%20I%20have%20made%20payment%20for%20order%20${order.id}%20to%20${mpesaPhoneDisplay}.%20Amount:%20KSh%20${order.total.toLocaleString()}" 
                               target="_blank" 
                               style="display: inline-block; background: #25D366; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">
                                <i class="fab fa-whatsapp"></i> Confirm on WhatsApp
                            </a>
                        </div>
                    </div>
                </div>

                <div style="background: #dcfce7; padding: 15px; border-radius: 12px; margin-bottom: 20px;">
                    <p style="color: #166534; font-size: 0.9rem; margin: 0;">
                        <i class="fas fa-info-circle"></i> 
                        Pay to <strong>${mpesaPhoneDisplay}</strong>, then tap the payment-done button or confirm with us on WhatsApp so we can process your order immediately.
                    </p>
                </div>

                <button class="btn btn-primary" style="width: 100%;" onclick="closeOrderModal(); window.location.href=localPage('my-orders.html') + '?orderId=${order.id}'">
                    <i class="fas fa-check"></i> Payment Done
                </button>

                <button class="btn btn-outline" style="width: 100%; margin-top: 10px;" onclick="closeOrderModal()">
                    Pay Later
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    setTimeout(() => modal.classList.add('show'), 10);
    window.currentOrderModal = modal;
}

// Get product emoji
function getProductEmoji(productName) {
    const emojiMap = {
        'tomato': '🍅',
        'spinach': '🥬',
        'carrot': '🥕',
        'mango': '🥭',
        'avocado': '🥑',
        'pepper': '🌶️',
        'onion': '🧅',
        'potato': '🥔',
        'cabbage': '🥬',
        'lettuce': '🥬',
        'cucumber': '🥒',
        'orange': '🍊',
        'banana': '🍌',
        'apple': '🍎',
        'grape': '🍇',
        'watermelon': '🍉',
        'pineapple': '🍍'
    };
    
    const name = productName.toLowerCase();
    for (let key in emojiMap) {
        if (name.includes(key)) {
            return emojiMap[key];
        }
    }
    return '🥬';
}

// Generate order tracking
function generateOrderTracking(status) {
    const now = new Date();
    return [
        { title: 'Order Placed', icon: 'check', status: 'completed', time: now.toISOString() },
        { title: 'Order Confirmed', icon: 'check-double', status: status === 'pending' ? 'pending' : 'completed', time: status === 'pending' ? null : now.toISOString() },
        { title: 'Preparing Order', icon: 'box', status: 'pending', time: null },
        { title: 'Out for Delivery', icon: 'truck', status: 'pending', time: null },
        { title: 'Delivered', icon: 'home', status: 'pending', time: null }
    ];
}

// Send order notification to business owner
function sendOrderNotification(order) {
    // In production, this would call your backend API to send email/SMS
    console.log('New Order Notification:', order);
    
    // For now, you can manually check localStorage for new orders
    // Or integrate with services like:
    // - SendGrid for email
    // - Twilio for SMS
    // - Firebase Cloud Messaging
}

// Auto-reply notification system
function showAutoReplyNotification() {
    const notification = document.createElement('div');
    notification.className = 'auto-reply-notification';
    notification.innerHTML = `
        <div class="auto-reply-content">
            <i class="fas fa-robot"></i>
            <div>
                <strong>Auto-Reply Activated!</strong>
                <p>We'll respond to your order within 5-10 minutes. Thank you for your patience! 😊</p>
            </div>
        </div>
    `;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.classList.add('show');
    }, 100);
    
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 5000);
}

function showToast(message) {
    toastMessage.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, (char) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    }[char]));
}

function normalizeText(value) {
    return String(value || '')
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function getQuantityFromText(text) {
    const numberWords = {
        one: 1,
        two: 2,
        three: 3,
        four: 4,
        five: 5,
        six: 6,
        seven: 7,
        eight: 8,
        nine: 9,
        ten: 10
    };
    const numeric = text.match(/\b(\d+)\b/);
    if (numeric) return Number(numeric[1]);
    const word = Object.keys(numberWords).find((key) => new RegExp(`\\b${key}\\b`).test(text));
    return word ? numberWords[word] : 1;
}

function cleanProductRequest(text) {
    return normalizeText(text)
        .replace(/\b(add|buy|get|need|want|please|pls|cart|basket|some|of|the|and|with|for|me|i|would|like|to|kg|kgs|pieces|piece|pcs|pack|packs|bunch|bunches)\b/g, ' ')
        .replace(/\b(one|two|three|four|five|six|seven|eight|nine|ten|\d+)\b/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function productSearchText(product) {
    return normalizeText(`${product.name} ${product.category || ''} ${product.description || ''}`);
}

function findAgentMatches(requestText) {
    const query = cleanProductRequest(requestText);
    if (!query) return [];

    const queryWords = query.split(' ').filter(Boolean);
    return products
        .map((product) => {
            const searchable = productSearchText(product);
            const name = normalizeText(product.name);
            let score = 0;

            if (name === query) score += 100;
            if (name.includes(query)) score += 50;
            if (searchable.includes(query)) score += 30;
            score += queryWords.filter((word) => searchable.includes(word)).length * 12;

            return { product, score };
        })
        .filter((match) => match.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 4);
}

function splitAgentRequest(message) {
    return String(message || '')
        .split(/\s+(?:and|plus|also)\s+|,/i)
        .map((part) => part.trim())
        .filter(Boolean);
}

function appendAgentMessage(type, html) {
    if (!shopAgentMessages) return;
    const message = document.createElement('div');
    message.className = `shop-agent-message ${type}`;
    message.innerHTML = html;
    shopAgentMessages.appendChild(message);
    shopAgentMessages.scrollTop = shopAgentMessages.scrollHeight;
}

function appendAgentText(type, text) {
    appendAgentMessage(type, escapeHtml(text));
    if (type === 'agent') {
        speakAgentText(text);
    }
}

function setAgentVoiceStatus(message) {
    if (shopAgentStatus) {
        shopAgentStatus.textContent = message;
    }
}

function speakAgentText(text) {
    if (!('speechSynthesis' in window)) return;
    const cleanText = String(text || '').replace(/\s+/g, ' ').trim();
    if (!cleanText) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'en-KE';
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.volume = 0.95;
    window.speechSynthesis.speak(utterance);
}

function getShopAgentRecognition() {
    if (!SpeechRecognition) return null;
    if (shopAgentRecognition) return shopAgentRecognition;

    shopAgentRecognition = new SpeechRecognition();
    shopAgentRecognition.lang = 'en-KE';
    shopAgentRecognition.interimResults = false;
    shopAgentRecognition.continuous = false;
    shopAgentRecognition.maxAlternatives = 1;

    shopAgentRecognition.onstart = () => {
        shopAgentListening = true;
        shopAgent?.classList.add('listening');
        setAgentVoiceStatus('Listening... say what you want to add.');
    };

    shopAgentRecognition.onend = () => {
        shopAgentListening = false;
        shopAgent?.classList.remove('listening');
        setAgentVoiceStatus('Tap the mic and speak your shopping list.');
    };

    shopAgentRecognition.onerror = (event) => {
        shopAgentListening = false;
        shopAgent?.classList.remove('listening');
        const blocked = event.error === 'not-allowed' || event.error === 'service-not-allowed';
        const message = blocked
            ? 'Microphone access was blocked. You can still type your order.'
            : 'I could not hear that clearly. Please try again or type it.';
        setAgentVoiceStatus(message);
        appendAgentText('agent', message);
    };

    shopAgentRecognition.onresult = (event) => {
        const transcript = event.results?.[0]?.[0]?.transcript || '';
        if (!transcript.trim()) return;
        shopAgentInput.value = transcript;
        handleAgentCommand(transcript);
        shopAgentInput.value = '';
    };

    return shopAgentRecognition;
}

function startShopAgentVoice() {
    openShopAgent();
    const recognition = getShopAgentRecognition();
    if (!recognition) {
        const message = 'Voice shopping is not supported in this browser. You can still type your order here.';
        setAgentVoiceStatus(message);
        appendAgentText('agent', message);
        return;
    }

    if (shopAgentListening) {
        recognition.stop();
        return;
    }

    try {
        recognition.start();
    } catch (error) {
        setAgentVoiceStatus('Voice is already starting. Please wait a second.');
    }
}

function openShopAgent() {
    shopAgent?.classList.add('active');
    if (shopAgentMessages && shopAgentMessages.children.length === 0) {
        appendAgentText('agent', 'Welcome to Zion Groceries. Tell me your shopping list and I will add matching items to your basket.');
        appendAgentMessage('agent', '<div class="shop-agent-chips"><button type="button" data-agent-example="add 2 tomatoes and 1 mango">2 tomatoes, 1 mango</button><button type="button" data-agent-example="add milk and bread">milk and bread</button><button type="button" data-agent-example="show fruits">show fruits</button></div>');
    }
    if (!shopAgentWelcomed) {
        shopAgentWelcomed = true;
    }
    setTimeout(() => shopAgentInput?.focus(), 100);
}

function closeShopAgent() {
    shopAgent?.classList.remove('active');
    if (shopAgentRecognition && shopAgentListening) {
        shopAgentRecognition.stop();
    }
}

function renderAgentChoices(matches, quantity) {
    const buttons = matches.map(({ product }) => (
        `<button type="button" data-agent-product-id="${escapeHtml(product.id)}" data-agent-quantity="${quantity}">
            ${escapeHtml(product.name)} <span>${CONFIG.currency} ${Number(product.price).toLocaleString()}</span>
        </button>`
    )).join('');
    appendAgentMessage('agent', `<div>I found a few matches. Choose one:</div><div class="shop-agent-choices">${buttons}</div>`);
}

function handleAgentCommand(rawMessage) {
    const message = rawMessage.trim();
    if (!message) return;

    appendAgentText('user', message);

    if (!products.length) {
        appendAgentText('agent', 'Products are still loading. Try again in a moment.');
        return;
    }

    const normalized = normalizeText(message);
    if (/\b(open|show|view)\b.*\b(cart|basket)\b/.test(normalized)) {
        appendAgentText('agent', 'Opening your basket.');
        openCart();
        return;
    }

    if (/\b(checkout|pay|order)\b/.test(normalized)) {
        if (!cart.length) {
            appendAgentText('agent', 'Your basket is empty. Tell me what to add first.');
            return;
        }
        appendAgentText('agent', 'Taking you to checkout.');
        window.location.href = localPage('checkout.html');
        return;
    }

    const categoryMatch = normalized.match(/\b(show|find|search)\s+(produce|vegetables|fruits|dairy|staples|bakery|chicken|drinks|beverages|snacks)\b/);
    if (categoryMatch) {
        currentCategory = categoryMatch[2] === 'drinks' ? 'beverages' : categoryMatch[2];
        navLinks.forEach((link) => link.classList.toggle('active', link.dataset.category === currentCategory));
        renderProducts();
        appendAgentText('agent', `Showing ${getDepartmentLabel(currentCategory)}.`);
        document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' });
        return;
    }

    const parts = splitAgentRequest(message);
    const added = [];
    const unclear = [];

    parts.forEach((part) => {
        const quantity = getQuantityFromText(part);
        const matches = findAgentMatches(part);

        if (matches.length === 0) {
            unclear.push(part);
            return;
        }

        if (matches.length > 1 && matches[0].score - matches[1].score < 15) {
            renderAgentChoices(matches, quantity);
            return;
        }

        addProductToCart(matches[0].product, quantity);
        added.push(`${quantity} ${matches[0].product.name}`);
    });

    if (added.length) {
        appendAgentText('agent', `Added ${added.join(', ')} to your basket.`);
        showToast('Assistant updated your basket');
    }

    if (unclear.length) {
        appendAgentText('agent', `I could not find: ${unclear.join(', ')}. Try the product name as it appears in the shop.`);
    }

    if (!added.length && !unclear.length) {
        appendAgentText('agent', 'Try something like "add 2 tomatoes and 1 mango" or "show fruits".');
    }
}

function setupShopAgent() {
    bindClick(shopAgentToggle, openShopAgent);
    bindClick(shopAgentClose, closeShopAgent);
    bindClick(shopAgentVoice, startShopAgentVoice);

    if (shopAgentForm) {
        shopAgentForm.addEventListener('submit', (event) => {
            event.preventDefault();
            const value = shopAgentInput.value;
            shopAgentInput.value = '';
            handleAgentCommand(value);
        });
    }

    if (shopAgentMessages) {
        shopAgentMessages.addEventListener('click', (event) => {
            const productButton = event.target.closest('[data-agent-product-id]');
            if (productButton) {
                const product = products.find((item) => normalizeId(item.id) === normalizeId(productButton.dataset.agentProductId));
                if (product) {
                    const quantity = Number(productButton.dataset.agentQuantity || 1);
                    addProductToCart(product, quantity);
                    appendAgentText('agent', `Added ${quantity} ${product.name} to your basket.`);
                    showToast(`${product.name} added to cart!`);
                }
                return;
            }

            const exampleButton = event.target.closest('[data-agent-example]');
            if (exampleButton) {
                shopAgentInput.value = exampleButton.dataset.agentExample;
                shopAgentForm?.requestSubmit();
            }
        });
    }
}

function initializeRevealAnimations() {
    const revealElements = document.querySelectorAll('.reveal');
    if (revealElements.length === 0) {
        return;
    }

    if (!('IntersectionObserver' in window)) {
        revealElements.forEach((element) => element.classList.add('visible'));
        return;
    }

    const observer = new IntersectionObserver((entries, currentObserver) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                currentObserver.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    });

    revealElements.forEach((element) => observer.observe(element));
}

function setupEventListeners() {
    bindClick(cartBtn, openCart);
    bindClick(closeCart, closeCartSidebar);
    bindClick(cartOverlay, closeCartSidebar);
    bindClick(orderWhatsApp, sendWhatsAppOrder);
    bindClick(clearCartBtn, clearCart);
    setupShopAgent();
    if (searchInput) {
        searchInput.addEventListener('input', () => renderProducts());
    }
    
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            if (!link.dataset.category) {
                return;
            }
            e.preventDefault();
            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            currentCategory = link.dataset.category;
            renderProducts();
            document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' });
        });
    });

    document.querySelectorAll('[data-category-jump]').forEach(tile => {
        tile.addEventListener('click', (event) => {
            event.preventDefault();
            currentCategory = tile.dataset.categoryJump;
            navLinks.forEach(link => link.classList.toggle('active', link.dataset.category === currentCategory));
            renderProducts();
            document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' });
        });
    });
    
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeCartSidebar();
    });
}


