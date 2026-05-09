const express = require('express');
const fs = require('fs');
const path = require('path');
const { authenticateToken, optionalAuth } = require('../middleware/auth');

const router = express.Router();

// Data file paths
const reviewsPath = path.join(__dirname, '..', 'data', 'reviews.json');
const productsPath = path.join(__dirname, '..', 'data', 'products.json');
const ordersPath = path.join(__dirname, '..', 'data', 'orders.json');

// Helper functions
const readReviews = () => {
    try {
        const data = fs.readFileSync(reviewsPath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        return [];
    }
};

const writeReviews = (reviews) => {
    fs.writeFileSync(reviewsPath, JSON.stringify(reviews, null, 2));
};

const readProducts = () => {
    try {
        const data = fs.readFileSync(productsPath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        return [];
    }
};

const writeProducts = (products) => {
    fs.writeFileSync(productsPath, JSON.stringify(products, null, 2));
};

const readOrders = () => {
    try {
        const data = fs.readFileSync(ordersPath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        return [];
    }
};

// Update product rating after review changes
const updateProductRating = (productId) => {
    const reviews = readReviews();
    const productReviews = reviews.filter(r => r.productId === productId);
    
    const products = readProducts();
    const productIndex = products.findIndex(p => p.id === productId);
    
    if (productIndex !== -1) {
        const totalReviews = productReviews.length;
        const averageRating = totalReviews > 0 
            ? productReviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews 
            : 0;
        
        products[productIndex].averageRating = Math.round(averageRating * 10) / 10;
        products[productIndex].totalReviews = totalReviews;
        
        writeProducts(products);
    }
};

// Get reviews for a product (public - no auth required)
router.get('/product/:productId', optionalAuth, (req, res) => {
    try {
        const productId = parseInt(req.params.productId);
        const reviews = readReviews();
        
        const productReviews = reviews
            .filter(r => r.productId === productId)
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        res.json({ reviews: productReviews });
    } catch (error) {
        console.error('Fetch reviews error:', error);
        res.status(500).json({ error: 'Failed to fetch reviews' });
    }
});

// Add a review (requires authentication)
router.post('/', authenticateToken, (req, res) => {
    try {
        const { productId, rating, comment } = req.body;

        // Validation
        if (!productId || !rating) {
            return res.status(400).json({ error: 'Product ID and rating are required' });
        }

        if (rating < 1 || rating > 5) {
            return res.status(400).json({ error: 'Rating must be between 1 and 5' });
        }

        // Check if product exists
        const products = readProducts();
        const product = products.find(p => p.id === productId);
        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }

        // Check if user has purchased this product
        const orders = readOrders();
        const userOrders = orders.filter(o => 
            o.userId === req.user.id && 
            o.status === 'delivered' &&
            o.items.some(item => item.productId === productId)
        );

        if (userOrders.length === 0) {
            return res.status(403).json({ 
                error: 'You can only review products you have purchased and received' 
            });
        }

        const reviews = readReviews();

        // Check if user already reviewed this product
        const existingReview = reviews.find(r => 
            r.productId === productId && r.userId === req.user.id
        );

        if (existingReview) {
            return res.status(400).json({ 
                error: 'You have already reviewed this product. Use update endpoint to modify.' 
            });
        }

        // Create new review
        const newReview = {
            id: reviews.length > 0 ? Math.max(...reviews.map(r => r.id)) + 1 : 1,
            productId,
            userId: req.user.id,
            userName: req.user.fullName,
            userEmail: req.user.email,
            rating,
            comment: comment || '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        reviews.push(newReview);
        writeReviews(reviews);

        // Update product rating
        updateProductRating(productId);

        res.status(201).json({
            message: 'Review added successfully',
            review: newReview
        });
    } catch (error) {
        console.error('Add review error:', error);
        res.status(500).json({ error: 'Failed to add review' });
    }
});

// Update a review (requires authentication)
router.put('/:id', authenticateToken, (req, res) => {
    try {
        const { rating, comment } = req.body;

        if (rating && (rating < 1 || rating > 5)) {
            return res.status(400).json({ error: 'Rating must be between 1 and 5' });
        }

        const reviews = readReviews();
        const reviewIndex = reviews.findIndex(r => r.id === parseInt(req.params.id));

        if (reviewIndex === -1) {
            return res.status(404).json({ error: 'Review not found' });
        }

        const review = reviews[reviewIndex];

        // Check ownership
        if (review.userId !== req.user.id) {
            return res.status(403).json({ error: 'You can only update your own reviews' });
        }

        // Update review
        reviews[reviewIndex] = {
            ...review,
            rating: rating !== undefined ? rating : review.rating,
            comment: comment !== undefined ? comment : review.comment,
            updatedAt: new Date().toISOString()
        };

        writeReviews(reviews);

        // Update product rating
        updateProductRating(review.productId);

        res.json({
            message: 'Review updated successfully',
            review: reviews[reviewIndex]
        });
    } catch (error) {
        console.error('Update review error:', error);
        res.status(500).json({ error: 'Failed to update review' });
    }
});

// Delete a review (requires authentication)
router.delete('/:id', authenticateToken, (req, res) => {
    try {
        const reviews = readReviews();
        const reviewIndex = reviews.findIndex(r => r.id === parseInt(req.params.id));

        if (reviewIndex === -1) {
            return res.status(404).json({ error: 'Review not found' });
        }

        const review = reviews[reviewIndex];

        // Check ownership or admin
        if (review.userId !== req.user.id && !req.user.isAdmin) {
            return res.status(403).json({ error: 'You can only delete your own reviews' });
        }

        const productId = review.productId;
        reviews.splice(reviewIndex, 1);
        writeReviews(reviews);

        // Update product rating
        updateProductRating(productId);

        res.json({ message: 'Review deleted successfully' });
    } catch (error) {
        console.error('Delete review error:', error);
        res.status(500).json({ error: 'Failed to delete review' });
    }
});

// Get user's reviews (requires authentication)
router.get('/my-reviews', authenticateToken, (req, res) => {
    try {
        const reviews = readReviews();
        const userReviews = reviews
            .filter(r => r.userId === req.user.id)
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        res.json({ reviews: userReviews });
    } catch (error) {
        console.error('Fetch user reviews error:', error);
        res.status(500).json({ error: 'Failed to fetch reviews' });
    }
});

// Check if user can review a product (requires authentication)
router.get('/can-review/:productId', authenticateToken, (req, res) => {
    try {
        const productId = parseInt(req.params.productId);
        
        // Check if already reviewed
        const reviews = readReviews();
        const hasReviewed = reviews.some(r => 
            r.productId === productId && r.userId === req.user.id
        );

        if (hasReviewed) {
            return res.json({ canReview: false, reason: 'Already reviewed' });
        }

        // Check if purchased and delivered
        const orders = readOrders();
        const hasPurchased = orders.some(o => 
            o.userId === req.user.id && 
            o.status === 'delivered' &&
            o.items.some(item => item.productId === productId)
        );

        if (!hasPurchased) {
            return res.json({ canReview: false, reason: 'Must purchase and receive product first' });
        }

        res.json({ canReview: true });
    } catch (error) {
        console.error('Check review eligibility error:', error);
        res.status(500).json({ error: 'Failed to check review eligibility' });
    }
});

module.exports = router;
