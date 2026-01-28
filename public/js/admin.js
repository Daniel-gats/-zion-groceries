// ===== G-man Groceries - Admin Panel with Supabase =====

const SUPABASE_URL = 'https://oadqqddauhmgunibwzls.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9hZHFxZGRhdWhtZ3VuaWJ3emxzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkzMzIxNDgsImV4cCI6MjA4NDkwODE0OH0.ANp4tmeBlL8DQCDE3LsqhpdSQtbOFoVp6iTxCH5Zfew';

let products = [];
let editingId = null;

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

const totalProducts = document.getElementById('totalProducts');
const totalVegetables = document.getElementById('totalVegetables');
const totalFruits = document.getElementById('totalFruits');
const lowStock = document.getElementById('lowStock');

document.addEventListener('DOMContentLoaded', () => {
    fetchProducts();
    setupEventListeners();
});

async function fetchProducts() {
    try {
        // Try LOCAL SERVER FIRST (for Vercel deployment)
        try {
            console.log('🔍 Attempting to load from local server...');
            const localResponse = await fetch('/api/products');
            if (localResponse.ok) {
                const data = await localResponse.json();
                if (data && data.length > 0) {
                    products = data;
                    console.log('✅ Loaded from LOCAL SERVER:', products.length, 'products');
                    renderProducts();
                    updateStats();
                    return;
                }
            }
        } catch (localError) {
            console.log('⚠️ Local server not available:', localError.message);
        }
        
        // Try Supabase as backup
        const response = await fetch(`${SUPABASE_URL}/rest/v1/products?select=*&order=id`, {
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`
            }
        });
        if (response.ok) {
            products = await response.json();
            console.log('✅ Loaded from Supabase:', products.length, 'products');
            renderProducts();
            updateStats();
        } else {
            throw new Error('Failed to fetch');
        }
    } catch (error) {
        console.error('Error:', error);
        showToast('Error loading products', 'error');
    }
}

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
                        <img src="${product.image || 'https://via.placeholder.com/50x50?text=Product'}" alt="${product.name}" onerror="this.onerror=null;this.src='https://via.placeholder.com/50x50?text=No+Image'">
                        <div class="product-cell-info">
                            <h4>${product.name}</h4>
                            <span>${product.category}</span>
                        </div>
                    </div>
                </td>
                <td class="price-cell">KSh ${Number(product.price).toLocaleString()} / ${product.unit}</td>
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

function updateStats() {
    totalProducts.textContent = products.length;
    totalVegetables.textContent = products.filter(p => p.category === 'vegetables').length;
    totalFruits.textContent = products.filter(p => p.category === 'fruits').length;
    lowStock.textContent = products.filter(p => p.stock < 20).length;
}

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
        // Try LOCAL API FIRST
        try {
            if (editingId) {
                response = await fetch(`/api/products/${editingId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(productData)
                });
                if (response.ok) {
                    showToast('Product updated!', 'success');
                    resetForm();
                    fetchProducts();
                    return;
                }
            } else {
                response = await fetch('/api/products', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(productData)
                });
                if (response.ok) {
                    showToast('Product added!', 'success');
                    resetForm();
                    fetchProducts();
                    return;
                }
            }
        } catch (localError) {
            console.log('⚠️ Local API not available, trying Supabase...');
        }
        
        // Fallback to Supabase
        if (editingId) {
            response = await fetch(`${SUPABASE_URL}/rest/v1/products?id=eq.${editingId}`, {
                method: 'PATCH',
                headers: {
                    'apikey': SUPABASE_KEY,
                    'Authorization': `Bearer ${SUPABASE_KEY}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=minimal'
                },
                body: JSON.stringify(productData)
            });
            showToast('Product updated!', 'success');
        } else {
            response = await fetch(`${SUPABASE_URL}/rest/v1/products`, {
                method: 'POST',
                headers: {
                    'apikey': SUPABASE_KEY,
                    'Authorization': `Bearer ${SUPABASE_KEY}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=minimal'
                },
                body: JSON.stringify(productData)
            });
            showToast('Product added!', 'success');
        }
        
        resetForm();
        fetchProducts();
    } catch (error) {
        console.error('Error:', error);
        showToast('Error saving product', 'error');
    }
}

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
    document.getElementById('productImage').value = product.image || '';
    document.getElementById('productDescription').value = product.description || '';
    
    formTitle.innerHTML = '<i class="fas fa-edit"></i> Edit Product';
    submitBtn.innerHTML = '<i class="fas fa-save"></i> Update Product';
    cancelBtn.style.display = 'block';
    
    document.querySelector('.form-section').scrollIntoView({ behavior: 'smooth' });
}

async function deleteProduct(id) {
    const product = products.find(p => p.id === id);
    if (!product) return;
    
    if (!confirm(`Delete "${product.name}"?`)) return;
    
    try {
        // Try LOCAL API FIRST
        try {
            const response = await fetch(`/api/products/${id}`, {
                method: 'DELETE'
            });
            if (response.ok) {
                showToast('Product deleted!', 'success');
                fetchProducts();
                return;
            }
        } catch (localError) {
            console.log('⚠️ Local API not available, trying Supabase...');
        }
        
        // Fallback to Supabase
        await fetch(`${SUPABASE_URL}/rest/v1/products?id=eq.${id}`, {
            method: 'DELETE',
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`
            }
        });
        showToast('Product deleted!', 'success');
        fetchProducts();
    } catch (error) {
        console.error('Error:', error);
        showToast('Error deleting product', 'error');
    }
}

function resetForm() {
    editingId = null;
    productForm.reset();
    document.getElementById('productId').value = '';
    formTitle.innerHTML = '<i class="fas fa-plus-circle"></i> Add New Product';
    submitBtn.innerHTML = '<i class="fas fa-plus"></i> Add Product';
    cancelBtn.style.display = 'none';
}

function showToast(message, type = 'success') {
    toastMessage.textContent = message;
    toast.className = `toast ${type}`;
    toastIcon.className = type === 'success' ? 'fas fa-check-circle' : 'fas fa-exclamation-circle';
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

function setupEventListeners() {
    productForm.addEventListener('submit', handleSubmit);
    cancelBtn.addEventListener('click', resetForm);
    searchInput.addEventListener('input', () => renderProducts());
}
