// ===== Zion Groceries - Admin Panel =====

// State
let products = [];
let editingId = null;

// DOM Elements
const productForm = document.getElementById('productForm');
const formTitle = document.getElementById('formTitle');
const submitBtn = document.getElementById('submitBtn');
const cancelBtn = document.getElementById('cancelBtn');
const productsTableBody = document.getElementById('productsTableBody');
const emptyState = document.getElementById('emptyState');
const searchInput = document.getElementById('searchProducts');
const toast = document.getElementById('toast');
const toastMessage = document.getElementById('toastMessage');
const toastIcon = document.getElementById('toastIcon');

// Stats elements
const totalProducts = document.getElementById('totalProducts');
const totalVegetables = document.getElementById('totalVegetables');
const totalFruits = document.getElementById('totalFruits');
const lowStock = document.getElementById('lowStock');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    fetchProducts();
    setupEventListeners();
});

// Fetch products
async function fetchProducts() {
    try {
        const response = await fetch('/api/products');
        products = await response.json();
        renderProducts();
        updateStats();
    } catch (error) {
        console.error('Error fetching products:', error);
        showToast('Error loading products', 'error');
    }
}

// Render products table
function renderProducts(productsToRender = products) {
    const searchTerm = searchInput.value.toLowerCase().trim();
    let filtered = productsToRender;
    
    if (searchTerm) {
        filtered = productsToRender.filter(p => 
            p.name.toLowerCase().includes(searchTerm) ||
            p.category.toLowerCase().includes(searchTerm)
        );
    }
    
    if (filtered.length === 0) {
        productsTableBody.innerHTML = '';
        emptyState.style.display = 'block';
        return;
    }
    
    emptyState.style.display = 'none';
    
    productsTableBody.innerHTML = filtered.map(product => {
        let stockClass = 'in-stock';
        let stockText = 'In Stock';
        if (product.stock === 0) {
            stockClass = 'out-stock';
            stockText = 'Out of Stock';
        } else if (product.stock < 20) {
            stockClass = 'low-stock';
            stockText = 'Low Stock';
        }
        
        return `
            <tr>
                <td>
                    <div class="product-cell">
                        <img src="${product.image}" alt="${product.name}" onerror="this.src='https://via.placeholder.com/50x50?text=Product'">
                        <div class="product-cell-info">
                            <h4>${product.name}</h4>
                            <span>${product.category}</span>
                        </div>
                    </div>
                </td>
                <td class="price-cell">KSh ${product.price.toLocaleString()} / ${product.unit}</td>
                <td>
                    <div class="stock-cell">
                        <span>${product.stock}</span>
                        <span class="stock-badge ${stockClass}">${stockText}</span>
                    </div>
                </td>
                <td>
                    <div class="actions-cell">
                        <button class="btn-icon btn-edit" onclick="editProduct(${product.id})" title="Edit">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-icon btn-delete" onclick="deleteProduct(${product.id})" title="Delete">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

// Update statistics
function updateStats() {
    totalProducts.textContent = products.length;
    totalVegetables.textContent = products.filter(p => p.category === 'vegetables').length;
    totalFruits.textContent = products.filter(p => p.category === 'fruits').length;
    lowStock.textContent = products.filter(p => p.stock < 20).length;
}

// Add/Update product
async function handleSubmit(e) {
    e.preventDefault();
    
    const productData = {
        name: document.getElementById('productName').value.trim(),
        price: parseFloat(document.getElementById('productPrice').value),
        stock: parseInt(document.getElementById('productStock').value),
        category: document.getElementById('productCategory').value,
        unit: document.getElementById('productUnit').value,
        image: document.getElementById('productImage').value.trim() || 'https://via.placeholder.com/300x200?text=Product',
        description: document.getElementById('productDescription').value.trim()
    };
    
    try {
        let response;
        if (editingId) {
            response = await fetch(`/api/products/${editingId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(productData)
            });
            showToast('Product updated successfully!', 'success');
        } else {
            response = await fetch('/api/products', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(productData)
            });
            showToast('Product added successfully!', 'success');
        }
        
        if (response.ok) {
            resetForm();
            fetchProducts();
        } else {
            throw new Error('Failed to save product');
        }
    } catch (error) {
        console.error('Error saving product:', error);
        showToast('Error saving product', 'error');
    }
}

// Edit product
function editProduct(id) {
    const product = products.find(p => p.id === id);
    if (!product) return;
    
    editingId = id;
    
    document.getElementById('productId').value = id;
    document.getElementById('productName').value = product.name;
    document.getElementById('productPrice').value = product.price;
    document.getElementById('productStock').value = product.stock;
    document.getElementById('productCategory').value = product.category;
    document.getElementById('productUnit').value = product.unit;
    document.getElementById('productImage').value = product.image;
    document.getElementById('productDescription').value = product.description || '';
    
    formTitle.innerHTML = '<i class="fas fa-edit"></i> Edit Product';
    submitBtn.innerHTML = '<i class="fas fa-save"></i> Update Product';
    cancelBtn.style.display = 'block';
    
    document.querySelector('.form-section').scrollIntoView({ behavior: 'smooth' });
}

// Delete product
async function deleteProduct(id) {
    const product = products.find(p => p.id === id);
    if (!product) return;
    
    if (!confirm(`Are you sure you want to delete "${product.name}"?`)) return;
    
    try {
        const response = await fetch(`/api/products/${id}`, { method: 'DELETE' });
        
        if (response.ok) {
            showToast('Product deleted successfully!', 'success');
            fetchProducts();
        } else {
            throw new Error('Failed to delete product');
        }
    } catch (error) {
        console.error('Error deleting product:', error);
        showToast('Error deleting product', 'error');
    }
}

// Reset form
function resetForm() {
    editingId = null;
    productForm.reset();
    document.getElementById('productId').value = '';
    formTitle.innerHTML = '<i class="fas fa-plus-circle"></i> Add New Product';
    submitBtn.innerHTML = '<i class="fas fa-plus"></i> Add Product';
    cancelBtn.style.display = 'none';
}

// Show toast
function showToast(message, type = 'success') {
    toastMessage.textContent = message;
    toast.className = `toast ${type}`;
    toastIcon.className = type === 'success' ? 'fas fa-check-circle' : 'fas fa-exclamation-circle';
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// Setup event listeners
function setupEventListeners() {
    productForm.addEventListener('submit', handleSubmit);
    cancelBtn.addEventListener('click', resetForm);
    searchInput.addEventListener('input', () => renderProducts());
}
