const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Data file path
const dataPath = path.join(__dirname, 'data', 'products.json');

// Helper functions to read/write products
const readProducts = () => {
    try {
        const data = fs.readFileSync(dataPath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        return [];
    }
};

const writeProducts = (products) => {
    fs.writeFileSync(dataPath, JSON.stringify(products, null, 2));
};

// API Routes

// Get all products
app.get('/api/products', (req, res) => {
    const products = readProducts();
    res.json(products);
});

// Get single product
app.get('/api/products/:id', (req, res) => {
    const products = readProducts();
    const product = products.find(p => p.id === parseInt(req.params.id));
    if (product) {
        res.json(product);
    } else {
        res.status(404).json({ error: 'Product not found' });
    }
});

// Add new product (Admin)
app.post('/api/products', (req, res) => {
    const products = readProducts();
    const newProduct = {
        id: products.length > 0 ? Math.max(...products.map(p => p.id)) + 1 : 1,
        name: req.body.name,
        price: parseFloat(req.body.price),
        category: req.body.category,
        image: req.body.image || 'https://via.placeholder.com/200x200?text=Product',
        unit: req.body.unit || 'kg',
        stock: parseInt(req.body.stock) || 100,
        description: req.body.description || '',
        createdAt: new Date().toISOString()
    };
    products.push(newProduct);
    writeProducts(products);
    res.status(201).json(newProduct);
});

// Update product (Admin)
app.put('/api/products/:id', (req, res) => {
    const products = readProducts();
    const index = products.findIndex(p => p.id === parseInt(req.params.id));
    if (index !== -1) {
        products[index] = {
            ...products[index],
            name: req.body.name || products[index].name,
            price: req.body.price !== undefined ? parseFloat(req.body.price) : products[index].price,
            category: req.body.category || products[index].category,
            image: req.body.image || products[index].image,
            unit: req.body.unit || products[index].unit,
            stock: req.body.stock !== undefined ? parseInt(req.body.stock) : products[index].stock,
            description: req.body.description !== undefined ? req.body.description : products[index].description,
            updatedAt: new Date().toISOString()
        };
        writeProducts(products);
        res.json(products[index]);
    } else {
        res.status(404).json({ error: 'Product not found' });
    }
});

// Delete product (Admin)
app.delete('/api/products/:id', (req, res) => {
    const products = readProducts();
    const index = products.findIndex(p => p.id === parseInt(req.params.id));
    if (index !== -1) {
        const deleted = products.splice(index, 1);
        writeProducts(products);
        res.json({ message: 'Product deleted', product: deleted[0] });
    } else {
        res.status(404).json({ error: 'Product not found' });
    }
});

// Get products by category
app.get('/api/products/category/:category', (req, res) => {
    const products = readProducts();
    const filtered = products.filter(p => 
        p.category.toLowerCase() === req.params.category.toLowerCase()
    );
    res.json(filtered);
});

// Serve main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Serve admin page
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`🥬 Zion Groceries server running on http://localhost:${PORT}`);
    console.log(`📦 Admin panel available at http://localhost:${PORT}/admin`);
});
