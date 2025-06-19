// server.js - Complete Express server for Week 2 assignment
// Import required modules
const express = require('express');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Sample in-memory products database
let products = [
    {
        id: '1',
        name: 'Laptop',
        description: 'High-performance laptop with 16GB RAM',
        price: 1200,
        category: 'electronics',
        inStock: true
    },
    {
        id: '2',
        name: 'Smartphone',
        description: 'Latest model with 128GB storage',
        price: 800,
        category: 'electronics',
        inStock: true
    },
    {
        id: '3',
        name: 'Coffee Maker',
        description: 'Programmable coffee maker with timer',
        price: 50,
        category: 'kitchen',
        inStock: false
    }
];

// Custom Error Classes
class NotFoundError extends Error {
    constructor(message) {
        super(message);
        this.name = 'NotFoundError';
        this.statusCode = 404;
    }
}

class ValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ValidationError';
        this.statusCode = 400;
    }
}

class AuthenticationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'AuthenticationError';
        this.statusCode = 401;
    }
}

// Custom Middleware
// Logger middleware
const loggerMiddleware = (req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${req.method} ${req.url}`);
    next();
};

// Authentication middleware
const authMiddleware = (req, res, next) => {
    const apiKey = req.headers['x-api-key'];
    
    // Skip auth for GET requests (read-only operations)
    if (req.method === 'GET') {
        return next();
    }
    
    if (!apiKey || apiKey !== 'your-secret-api-key') {
        return next(new AuthenticationError('Invalid or missing API key'));
    }
    
    next();
};

// Validation middleware for product data
const validateProduct = (req, res, next) => {
    const { name, description, price, category, inStock } = req.body;
    const errors = [];
    
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
        errors.push('Name is required and must be a non-empty string');
    }
    
    if (!description || typeof description !== 'string' || description.trim().length === 0) {
        errors.push('Description is required and must be a non-empty string');
    }
    
    if (price === undefined || typeof price !== 'number' || price < 0) {
        errors.push('Price is required and must be a non-negative number');
    }
    
    if (!category || typeof category !== 'string' || category.trim().length === 0) {
        errors.push('Category is required and must be a non-empty string');
    }
    
    if (inStock === undefined || typeof inStock !== 'boolean') {
        errors.push('inStock is required and must be a boolean');
    }
    
    if (errors.length > 0) {
        return next(new ValidationError(errors.join(', ')));
    }
    
    next();
};

// Async error wrapper
const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

// Apply global middleware
app.use(bodyParser.json());
app.use(loggerMiddleware);

// Root route
app.get('/', (req, res) => {
    res.json({
        message: 'Welcome to the Product API!',
        endpoints: {
            'GET /api/products': 'Get all products',
            'GET /api/products/:id': 'Get a specific product',
            'POST /api/products': 'Create a new product',
            'PUT /api/products/:id': 'Update a product',
            'DELETE /api/products/:id': 'Delete a product',
            'GET /api/products/search': 'Search products by name',
            'GET /api/products/stats': 'Get product statistics'
        }
    });
});

// GET /api/products - Get all products with filtering and pagination
app.get('/api/products', asyncHandler(async (req, res) => {
    let filteredProducts = [...products];
    
    // Filter by category
    if (req.query.category) {
        filteredProducts = filteredProducts.filter(
            product => product.category.toLowerCase() === req.query.category.toLowerCase()
        );
    }
    
    // Filter by inStock status
    if (req.query.inStock !== undefined) {
        const inStockFilter = req.query.inStock === 'true';
        filteredProducts = filteredProducts.filter(
            product => product.inStock === inStockFilter
        );
    }
    
    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    
    const paginatedProducts = filteredProducts.slice(startIndex, endIndex);
    
    res.json({
        products: paginatedProducts,
        pagination: {
            currentPage: page,
            totalPages: Math.ceil(filteredProducts.length / limit),
            totalProducts: filteredProducts.length,
            productsPerPage: limit
        }
    });
}));

// GET /api/products/search - Search products by name
app.get('/api/products/search', asyncHandler(async (req, res) => {
    const { q } = req.query;
    
    if (!q) {
        throw new ValidationError('Search query parameter "q" is required');
    }
    
    const searchResults = products.filter(product =>
        product.name.toLowerCase().includes(q.toLowerCase()) ||
        product.description.toLowerCase().includes(q.toLowerCase())
    );
    
    res.json({
        query: q,
        results: searchResults,
        count: searchResults.length
    });
}));

// GET /api/products/stats - Get product statistics
app.get('/api/products/stats', asyncHandler(async (req, res) => {
    const stats = {
        totalProducts: products.length,
        inStockCount: products.filter(p => p.inStock).length,
        outOfStockCount: products.filter(p => !p.inStock).length,
        categoryCounts: {},
        averagePrice: 0,
        priceRange: {
            min: 0,
            max: 0
        }
    };
    
    // Calculate category counts
    products.forEach(product => {
        stats.categoryCounts[product.category] = 
            (stats.categoryCounts[product.category] || 0) + 1;
    });
    
    // Calculate average price
    if (products.length > 0) {
        const totalPrice = products.reduce((sum, product) => sum + product.price, 0);
        stats.averagePrice = Math.round((totalPrice / products.length) * 100) / 100;
        
        // Calculate price range
        const prices = products.map(p => p.price);
        stats.priceRange.min = Math.min(...prices);
        stats.priceRange.max = Math.max(...prices);
    }
    
    res.json(stats);
}));

// GET /api/products/:id - Get a specific product by ID
app.get('/api/products/:id', asyncHandler(async (req, res) => {
    const product = products.find(p => p.id === req.params.id);
    
    if (!product) {
        throw new NotFoundError(`Product with ID ${req.params.id} not found`);
    }
    
    res.json(product);
}));

// POST /api/products - Create a new product
app.post('/api/products', authMiddleware, validateProduct, asyncHandler(async (req, res) => {
    const newProduct = {
        id: uuidv4(),
        name: req.body.name.trim(),
        description: req.body.description.trim(),
        price: req.body.price,
        category: req.body.category.trim().toLowerCase(),
        inStock: req.body.inStock
    };
    
    products.push(newProduct);
    
    res.status(201).json({
        message: 'Product created successfully',
        product: newProduct
    });
}));

// PUT /api/products/:id - Update an existing product
app.put('/api/products/:id', authMiddleware, validateProduct, asyncHandler(async (req, res) => {
    const productIndex = products.findIndex(p => p.id === req.params.id);
    
    if (productIndex === -1) {
        throw new NotFoundError(`Product with ID ${req.params.id} not found`);
    }
    
    const updatedProduct = {
        id: req.params.id,
        name: req.body.name.trim(),
        description: req.body.description.trim(),
        price: req.body.price,
        category: req.body.category.trim().toLowerCase(),
        inStock: req.body.inStock
    };
    
    products[productIndex] = updatedProduct;
    
    res.json({
        message: 'Product updated successfully',
        product: updatedProduct
    });
}));

// DELETE /api/products/:id - Delete a product
app.delete('/api/products/:id', authMiddleware, asyncHandler(async (req, res) => {
    const productIndex = products.findIndex(p => p.id === req.params.id);
    
    if (productIndex === -1) {
        throw new NotFoundError(`Product with ID ${req.params.id} not found`);
    }
    
    const deletedProduct = products.splice(productIndex, 1)[0];
    
    res.json({
        message: 'Product deleted successfully',
        product: deletedProduct
    });
}));

// Global Error Handling Middleware
app.use((err, req, res, next) => {
    console.error(`Error: ${err.message}`);
    console.error(err.stack);
    
    // Handle specific error types
    if (err instanceof ValidationError || err instanceof NotFoundError || err instanceof AuthenticationError) {
        return res.status(err.statusCode).json({
            error: err.name,
            message: err.message,
            statusCode: err.statusCode
        });
    }
    
    // Handle JSON parsing errors
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        return res.status(400).json({
            error: 'Invalid JSON',
            message: 'Request body contains invalid JSON',
            statusCode: 400
        });
    }
    
    // Default error handler
    res.status(500).json({
        error: 'Internal Server Error',
        message: 'Something went wrong on the server',
        statusCode: 500
    });
});

// Handle 404 for undefined routes
app.use('*', (req, res) => {
    res.status(404).json({
        error: 'Not Found',
        message: `Route ${req.method} ${req.originalUrl} not found`,
        statusCode: 404
    });
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log(`Visit http://localhost:${PORT} to see available endpoints`);
});

// Export the app for testing purposes
module.exports = app;