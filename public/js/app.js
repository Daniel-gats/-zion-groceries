// ===== Zion Groceries - Main Application =====

// Configuration
const CONFIG = {
    whatsappNumber: '254745562238',
    currency: 'KSh'
};

// Embedded Products Data (works without server)
const PRODUCTS_DATA = [
    {"id":1,"name":"Fresh Tomatoes","price":80,"category":"vegetables","image":"https://images.unsplash.com/photo-1546470427-0d4db154cde8?w=300&h=300&fit=crop","unit":"kg","stock":50,"description":"Fresh, ripe red tomatoes perfect for salads and cooking"},
    {"id":2,"name":"Spinach","price":40,"category":"vegetables","image":"https://images.unsplash.com/photo-1576045057995-568f588f82fb?w=300&h=300&fit=crop","unit":"bunch","stock":30,"description":"Fresh green spinach leaves, rich in iron"},
    {"id":3,"name":"Carrots","price":60,"category":"vegetables","image":"https://images.unsplash.com/photo-1598170845058-32b9d6a5da37?w=300&h=300&fit=crop","unit":"kg","stock":45,"description":"Crunchy orange carrots, great for juicing or cooking"},
    {"id":4,"name":"Onions","price":50,"category":"vegetables","image":"https://images.unsplash.com/photo-1618512496248-a07fe83aa8cb?w=300&h=300&fit=crop","unit":"kg","stock":60,"description":"Fresh onions, essential for every kitchen"},
    {"id":5,"name":"Cabbage","price":45,"category":"vegetables","image":"https://images.unsplash.com/photo-1594282486552-05b4d80fbb9f?w=300&h=300&fit=crop","unit":"head","stock":25,"description":"Fresh green cabbage, perfect for salads and stir-fry"},
    {"id":6,"name":"Green Peppers","price":120,"category":"vegetables","image":"https://images.unsplash.com/photo-1563565375-f3fdfdbefa83?w=300&h=300&fit=crop","unit":"kg","stock":35,"description":"Crisp green bell peppers"},
    {"id":7,"name":"Bananas","price":70,"category":"fruits","image":"https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=300&h=300&fit=crop","unit":"bunch","stock":40,"description":"Sweet ripe bananas, rich in potassium"},
    {"id":8,"name":"Oranges","price":100,"category":"fruits","image":"https://images.unsplash.com/photo-1547514701-42782101795e?w=300&h=300&fit=crop","unit":"kg","stock":55,"description":"Juicy oranges, packed with Vitamin C"},
    {"id":9,"name":"Apples","price":150,"category":"fruits","image":"https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=300&h=300&fit=crop","unit":"kg","stock":40,"description":"Crisp red apples, sweet and delicious"},
    {"id":10,"name":"Mangoes","price":80,"category":"fruits","image":"https://images.unsplash.com/photo-1553279768-865429fa0078?w=300&h=300&fit=crop","unit":"kg","stock":30,"description":"Sweet ripe mangoes, the king of fruits"},
    {"id":11,"name":"Watermelon","price":200,"category":"fruits","image":"https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=300&h=300&fit=crop","unit":"piece","stock":15,"description":"Refreshing watermelon, perfect for hot days"},
    {"id":12,"name":"Pineapple","price":120,"category":"fruits","image":"https://images.unsplash.com/photo-1550258987-190a2d41a8ba?w=300&h=300&fit=crop","unit":"piece","stock":20,"description":"Sweet tropical pineapple"},
    {"id":13,"name":"Potatoes","price":55,"category":"vegetables","image":"https://images.unsplash.com/photo-1518977676601-b53f82ber9fb?w=300&h=300&fit=crop","unit":"kg","stock":70,"description":"Fresh potatoes, versatile for any dish"},
    {"id":14,"name":"Kale (Sukuma Wiki)","price":30,"category":"vegetables","image":"https://images.unsplash.com/photo-1524179091875-bf99a9a6af57?w=300&h=300&fit=crop","unit":"bunch","stock":50,"description":"Fresh kale leaves, a Kenyan favorite"},
    {"id":15,"name":"Avocados","price":20,"category":"fruits","image":"https://images.unsplash.com/photo-1523049673857-eb18f1d7b578?w=300&h=300&fit=crop","unit":"piece","stock":45,"description":"Creamy ripe avocados"},
    {"id":16,"name":"Lemons","price":10,"category":"fruits","image":"https://images.unsplash.com/photo-1590502593747-42a996133562?w=300&h=300&fit=crop","unit":"piece","stock":100,"description":"Fresh lemons for cooking and drinks"}
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

// Fetch products - try API first, fallback to embedded data
async function fetchProducts() {
    try {
        loading.style.display = 'block';
        productsGrid.style.display = 'none';
        
        // Try API first
        try {
            const response = await fetch('/api/products');
            if (response.ok) {
                products = await response.json();
            } else {
                throw new Error('API not available');
            }
        } catch (apiError) {
            // Fallback to embedded products
            console.log('Using embedded products data');
            products = PRODUCTS_DATA;
        }
        
        loading.style.display = 'none';
        productsGrid.style.display = 'grid';
        
        renderProducts();
    } catch (error) {
        console.error('Error fetching products:', error);
        // Final fallback
        products = PRODUCTS_DATA;
        loading.style.display = 'none';
        productsGrid.style.display = 'grid';
        renderProducts();
    }
}

// Render products
function renderProducts(productsToRender = products) {
    // Filter by category
    let filtered = productsToRender;
    if (currentCategory !== 'all') {
        filtered = productsToRender.filter(p => p.category === currentCategory);
    }
    
    // Filter by search
    const searchTerm = searchInput.value.toLowerCase().trim();
    if (searchTerm) {
        filtered = filtered.filter(p => 
            p.name.toLowerCase().includes(searchTerm) ||
            p.description.toLowerCase().includes(searchTerm)
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
                <p class="product-description">${product.description}</p>
                <div class="product-price">
                    ${CONFIG.currency} ${product.price.toLocaleString()} <span>/ ${product.unit}</span>
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

// Quantity controls
function incrementQuantity(productId) {
    const input = document.getElementById(`qty-${productId}`);
    const max = parseInt(input.max);
    const current = parseInt(input.value);
    if (current < max) {
        input.value = current + 1;
    }
}

function decrementQuantity(productId) {
    const input = document.getElementById(`qty-${productId}`);
    const current = parseInt(input.value);
    if (current > 1) {
        input.value = current - 1;
    }
}

// Add to cart
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
            price: product.price,
            unit: product.unit,
            image: product.image,
            quantity: quantity
        });
    }
    
    saveCart();
    updateCartUI();
    showToast(`${product.name} added to cart!`);
    
    // Reset quantity input
    quantityInput.value = 1;
}

// Remove from cart
function removeFromCart(productId) {
    cart = cart.filter(item => item.id !== productId);
    saveCart();
    updateCartUI();
    showToast('Item removed from cart');
}

// Update cart item quantity
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

// Save cart to localStorage
function saveCart() {
    localStorage.setItem('zionCart', JSON.stringify(cart));
}

// Update cart UI
function updateCartUI() {
    // Update cart count
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    cartCount.textContent = totalItems;
    
    // Update cart items
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
        
        // Update total
        const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        cartTotal.textContent = `${CONFIG.currency} ${total.toLocaleString()}`;
    }
}

// Open/Close cart
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

// Clear cart
function clearCart() {
    if (cart.length === 0) return;
    
    if (confirm('Are you sure you want to clear your cart?')) {
        cart = [];
        saveCart();
        updateCartUI();
        showToast('Cart cleared');
    }
}

// Order via WhatsApp
function sendWhatsAppOrder() {
    if (cart.length === 0) {
        showToast('Your cart is empty!');
        return;
    }
    
    // Build order message
    let message = '🛒 *New Order from Zion Groceries*\n\n';
    message += '📦 *Order Details:*\n';
    message += '─────────────────\n';
    
    cart.forEach((item, index) => {
        const subtotal = item.price * item.quantity;
        message += `${index + 1}. ${item.name}\n`;
        message += `   Qty: ${item.quantity} ${item.unit}(s) × ${CONFIG.currency} ${item.price.toLocaleString()}\n`;
        message += `   Subtotal: ${CONFIG.currency} ${subtotal.toLocaleString()}\n\n`;
    });
    
    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    message += '─────────────────\n';
    message += `💰 *Total: ${CONFIG.currency} ${total.toLocaleString()}*\n\n`;
    message += '📍 *Delivery Address:*\n[Please enter your delivery address]\n\n';
    message += '📞 *Contact Number:*\n[Your phone number]\n\n';
    message += 'Thank you for ordering from Zion Groceries! 🥬🍎';
    
    // Encode message for URL
    const encodedMessage = encodeURIComponent(message);
    
    // Open WhatsApp
    const whatsappUrl = `https://wa.me/${CONFIG.whatsappNumber}?text=${encodedMessage}`;
    window.open(whatsappUrl, '_blank');
}

// Show toast notification
function showToast(message) {
    toastMessage.textContent = message;
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// Setup event listeners
function setupEventListeners() {
    // Cart toggle
    cartBtn.addEventListener('click', openCart);
    closeCart.addEventListener('click', closeCartSidebar);
    cartOverlay.addEventListener('click', closeCartSidebar);
    
    // WhatsApp order
    orderWhatsApp.addEventListener('click', sendWhatsAppOrder);
    
    // Clear cart
    clearCartBtn.addEventListener('click', clearCart);
    
    // Search
    searchInput.addEventListener('input', () => {
        renderProducts();
    });
    
    // Category navigation
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            
            // Update active state
            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            
            // Update category and render
            currentCategory = link.dataset.category;
            renderProducts();
        });
    });
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeCartSidebar();
        }
    });
}
