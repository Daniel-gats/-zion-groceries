// ===== G-man Groceries - Main Application =====

// Supabase Configuration
const SUPABASE_URL = 'https://oadqqddauhmgunibwzls.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9hZHFxZGRhdWhtZ3VuaWJ3emxzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkzMzIxNDgsImV4cCI6MjA4NDkwODE0OH0.ANp4tmeBlL8DQCDE3LsqhpdSQtbOFoVp6iTxCH5Zfew';

// Configuration
const CONFIG = {
    whatsappNumber: '254745562238',
    currency: 'KSh'
};

// Fallback Products Data
const PRODUCTS_DATA = [
    {"id":1,"name":"Fresh Tomatoes","price":80,"category":"vegetables","image":"https://images.unsplash.com/photo-1546470427-0d4db154cde8?w=300&h=300&fit=crop","unit":"kg","stock":50,"description":"Fresh ripe red tomatoes"},
    {"id":2,"name":"Spinach","price":40,"category":"vegetables","image":"https://images.unsplash.com/photo-1576045057995-568f588f82fb?w=300&h=300&fit=crop","unit":"bunch","stock":30,"description":"Fresh green spinach leaves"},
    {"id":3,"name":"Carrots","price":60,"category":"vegetables","image":"https://images.unsplash.com/photo-1598170845058-32b9d6a5da37?w=300&h=300&fit=crop","unit":"kg","stock":45,"description":"Crunchy orange carrots"},
    {"id":4,"name":"Onions","price":50,"category":"vegetables","image":"https://images.unsplash.com/photo-1618512496248-a07fe83aa8cb?w=300&h=300&fit=crop","unit":"kg","stock":60,"description":"Fresh onions"},
    {"id":5,"name":"Cabbage","price":45,"category":"vegetables","image":"https://images.unsplash.com/photo-1594282486552-05b4d80fbb9f?w=300&h=300&fit=crop","unit":"head","stock":25,"description":"Fresh green cabbage"},
    {"id":6,"name":"Green Peppers","price":120,"category":"vegetables","image":"https://images.unsplash.com/photo-1563565375-f3fdfdbefa83?w=300&h=300&fit=crop","unit":"kg","stock":35,"description":"Crisp green bell peppers"},
    {"id":7,"name":"Bananas","price":70,"category":"fruits","image":"https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=300&h=300&fit=crop","unit":"bunch","stock":40,"description":"Sweet ripe bananas"},
    {"id":8,"name":"Oranges","price":100,"category":"fruits","image":"https://images.unsplash.com/photo-1547514701-42782101795e?w=300&h=300&fit=crop","unit":"kg","stock":55,"description":"Juicy oranges"},
    {"id":9,"name":"Apples","price":150,"category":"fruits","image":"https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=300&h=300&fit=crop","unit":"kg","stock":40,"description":"Crisp red apples"},
    {"id":10,"name":"Mangoes","price":80,"category":"fruits","image":"https://images.unsplash.com/photo-1553279768-865429fa0078?w=300&h=300&fit=crop","unit":"kg","stock":30,"description":"Sweet ripe mangoes"},
    {"id":11,"name":"Watermelon","price":200,"category":"fruits","image":"https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=300&h=300&fit=crop","unit":"piece","stock":15,"description":"Refreshing watermelon"},
    {"id":12,"name":"Pineapple","price":120,"category":"fruits","image":"https://images.unsplash.com/photo-1550258987-190a2d41a8ba?w=300&h=300&fit=crop","unit":"piece","stock":20,"description":"Sweet tropical pineapple"},
    {"id":13,"name":"Kale Sukuma Wiki","price":30,"category":"vegetables","image":"https://images.unsplash.com/photo-1524179091875-bf99a9a6af57?w=300&h=300&fit=crop","unit":"bunch","stock":50,"description":"Fresh kale leaves"},
    {"id":14,"name":"Avocados","price":20,"category":"fruits","image":"https://images.unsplash.com/photo-1523049673857-eb18f1d7b578?w=300&h=300&fit=crop","unit":"piece","stock":45,"description":"Creamy ripe avocados"},
    {"id":15,"name":"Lemons","price":10,"category":"fruits","image":"https://images.unsplash.com/photo-1590502593747-42a996133562?w=300&h=300&fit=crop","unit":"piece","stock":100,"description":"Fresh lemons"}
];

// State
let products = [];
let cart = JSON.parse(localStorage.getItem('zionCart')) || [];
let currentCategory = 'all';

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

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    fetchProducts();
    updateCartUI();
    setupEventListeners();
});

// Fetch products from local server, Supabase, or fallback
async function fetchProducts() {
    try {
        loading.style.display = 'block';
        productsGrid.style.display = 'none';
        
        // Try LOCAL SERVER FIRST (highest priority)
        try {
            console.log('🔍 Attempting to load from local server...');
            const localResponse = await fetch('/api/products');
            if (localResponse.ok) {
                const data = await localResponse.json();
                if (data && data.length > 0) {
                    products = data;
                    console.log('✅ Loaded from LOCAL SERVER:', products.length, 'products');
                    loading.style.display = 'none';
                    productsGrid.style.display = 'grid';
                    renderProducts();
                    return;
                }
            }
        } catch (localError) {
            console.log('⚠️ Local server not available:', localError.message);
        }
        
        // Try Supabase as backup
        try {
            console.log('🔍 Attempting to load from Supabase...');
            const response = await fetch(`${SUPABASE_URL}/rest/v1/products?select=*`, {
                headers: {
                    'apikey': SUPABASE_KEY,
                    'Authorization': `Bearer ${SUPABASE_KEY}`
                }
            });
            if (response.ok) {
                const data = await response.json();
                if (data && data.length > 0) {
                    products = data;
                    console.log('✅ Loaded from Supabase:', products.length, 'products');
                    loading.style.display = 'none';
                    productsGrid.style.display = 'grid';
                    renderProducts();
                    return;
                }
            }
        } catch (supabaseError) {
            console.log('⚠️ Supabase not available:', supabaseError.message);
        }
        
        // Use hardcoded fallback data as last resort
        console.log('⚠️ Using FALLBACK data:', PRODUCTS_DATA.length, 'products');
        products = PRODUCTS_DATA;
        loading.style.display = 'none';
        productsGrid.style.display = 'grid';
        renderProducts();
    } catch (error) {
        console.error('❌ Error loading products:', error);
        products = PRODUCTS_DATA;
        loading.style.display = 'none';
        productsGrid.style.display = 'grid';
        renderProducts();
    }
}

// Render products
function renderProducts(productsToRender = products) {
    let filtered = productsToRender;
    if (currentCategory !== 'all') {
        filtered = productsToRender.filter(p => p.category === currentCategory);
    }
    
    const searchTerm = searchInput.value.toLowerCase().trim();
    if (searchTerm) {
        filtered = filtered.filter(p => 
            p.name.toLowerCase().includes(searchTerm) ||
            (p.description && p.description.toLowerCase().includes(searchTerm))
        );
    }
    
    if (filtered.length === 0) {
        productsGrid.style.display = 'none';
        noProducts.style.display = 'block';
        return;
    }
    
    noProducts.style.display = 'none';
    productsGrid.style.display = 'grid';
    
    productsGrid.innerHTML = filtered.map(product => `
        <div class="product-card" data-id="${product.id}">
            <div class="product-image">
                <img src="${product.image}" alt="${product.name}" onerror="this.src='https://via.placeholder.com/300x200?text=Product'">
                <span class="product-category">${product.category}</span>
            </div>
            <div class="product-info">
                <h3 class="product-name">${product.name}</h3>
                <p class="product-description">${product.description || ''}</p>
                <div class="product-price">
                    ${CONFIG.currency} ${Number(product.price).toLocaleString()} <span>/ ${product.unit}</span>
                </div>
                <div class="product-actions">
                    <div class="quantity-control">
                        <button onclick="decrementQuantity(${product.id})">-</button>
                        <input type="number" id="qty-${product.id}" value="1" min="1" max="${product.stock}">
                        <button onclick="incrementQuantity(${product.id})">+</button>
                    </div>
                    <button class="add-to-cart" onclick="addToCart(${product.id})">
                        <i class="fas fa-cart-plus"></i> Add
                    </button>
                </div>
            </div>
        </div>
    `).join('');
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
    const product = products.find(p => p.id === productId);
    if (!product) return;
    
    const quantityInput = document.getElementById(`qty-${productId}`);
    const quantity = parseInt(quantityInput.value) || 1;
    
    const existingItem = cart.find(item => item.id === productId);
    
    if (existingItem) {
        existingItem.quantity += quantity;
    } else {
        cart.push({
            id: product.id,
            name: product.name,
            price: Number(product.price),
            unit: product.unit,
            image: product.image,
            quantity: quantity
        });
    }
    
    saveCart();
    updateCartUI();
    showToast(`${product.name} added to cart!`);
    quantityInput.value = 1;
}

function removeFromCart(productId) {
    cart = cart.filter(item => item.id !== productId);
    saveCart();
    updateCartUI();
    showToast('Item removed from cart');
}

function updateCartItemQuantity(productId, change) {
    const item = cart.find(item => item.id === productId);
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

function updateCartUI() {
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    cartCount.textContent = totalItems;
    
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
                    <img src="${item.image}" alt="${item.name}" onerror="this.src='https://via.placeholder.com/70x70?text=Product'">
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
        
        const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
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
    
    let message = '🛒 *New Order from G-man Groceries*\n\n📦 *Order Details:*\n─────────────────\n';
    
    cart.forEach((item, index) => {
        const subtotal = item.price * item.quantity;
        message += `${index + 1}. ${item.name}\n   Qty: ${item.quantity} × ${CONFIG.currency} ${item.price.toLocaleString()}\n   Subtotal: ${CONFIG.currency} ${subtotal.toLocaleString()}\n\n`;
    });
    
    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    message += `─────────────────\n💰 *Total: ${CONFIG.currency} ${total.toLocaleString()}*\n\n📍 *Delivery Address:*\n[Your address]\n\n📞 *Contact:*\n[Your phone]\n\nThank you! 🥬🍎`;
    
    const encodedMessage = encodeURIComponent(message);
    window.open(`https://wa.me/${CONFIG.whatsappNumber}?text=${encodedMessage}`, '_blank');
    
    // Show auto-reply notification
    showAutoReplyNotification();
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

function setupEventListeners() {
    cartBtn.addEventListener('click', openCart);
    closeCart.addEventListener('click', closeCartSidebar);
    cartOverlay.addEventListener('click', closeCartSidebar);
    orderWhatsApp.addEventListener('click', sendWhatsAppOrder);
    clearCartBtn.addEventListener('click', clearCart);
    searchInput.addEventListener('input', () => renderProducts());
    
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            currentCategory = link.dataset.category;
            renderProducts();
        });
    });
    
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeCartSidebar();
    });
}
