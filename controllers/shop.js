const path = require('path');
const fs = require('fs');
const pdfkit = require('pdfkit');
const User = require('../models/user');
const Product = require('../models/product');
const Order = require('../models/order');
const stripe = require('stripe')('sk_test_jgMU0XFtDkGphvChpFqkJNre00Gm1TgTgM');

const NUM_PAGE_ITEMS = 2;

exports.getProducts = (req, res, next) => {
    const page = +req.query.page || 1;
    let totalItems;

    Product.find()
        .countDocuments()
        .then(numProducts => {
            totalItems = numProducts;
            return Product.find()
                .skip((page - 1) * NUM_PAGE_ITEMS)
                .limit(NUM_PAGE_ITEMS);
        })
        .then(products => {
            res.render('shop/product-list', {
                prods: products,
                pageTitle: 'Products',
                path: '/products',
                currentPage: page,
                hasNextPage: NUM_PAGE_ITEMS * page < totalItems,
                hasPreviousPage: page > 1,
                nextPage: page + 1,
                previousPage: page - 1,
                lastPage: Math.ceil(totalItems / NUM_PAGE_ITEMS)
            });
        })
        .catch(err => {
            const error = new Error(err);
            error.httpStatusCode = 500;
            return next(error);
        });
};

exports.getProduct = async (req, res, next) => {
    const prodId = req.params.productId;
    try {
        const product = await Product.findById(prodId).populate('userId');
        const seller = product.userId;

        res.render('shop/product-detail', {
            product: product,
            pageTitle: product.title,
            path: '/products',
            sellerEmail: seller.email
        });
    } catch (ex) {
        console.log(ex);
    }
};

exports.getIndex = (req, res, next) => {
    const page = +req.query.page || 1;
    let totalItems;

    Product.find()
        .countDocuments()
        .then(numProducts => {
            totalItems = numProducts;
            return Product.find()
                .skip((page - 1) * NUM_PAGE_ITEMS)
                .limit(NUM_PAGE_ITEMS);
        })
        .then(products => {
            res.render('shop/index', {
                prods: products,
                pageTitle: 'Shop',
                path: '/',
                currentPage: page,
                hasNextPage: NUM_PAGE_ITEMS * page < totalItems,
                hasPreviousPage: page > 1,
                nextPage: page + 1,
                previousPage: page - 1,
                lastPage: Math.ceil(totalItems / NUM_PAGE_ITEMS)
            });
        })
        .catch(err => {
            const error = new Error(err);
            error.httpStatusCode = 500;
            return next(error);
        });
};

exports.getCart = (req, res, next) => {
    req.user
        .populate('cart.items.productId')
        .execPopulate()
        .then(user => {
            const products = user.cart.items;
            res.render('shop/cart', {
                path: '/cart',
                pageTitle: 'Your Cart',
                products: products,
            });
        })
        .catch(err => console.log(err));
};

exports.postCart = (req, res, next) => {
    const prodId = req.body.productId;
    Product.findById(prodId)
        .then(product => {
            return req.user.addToCart(product);
        })
        .then(result => {
            console.log(result);
            res.redirect('/cart');
        });
};

exports.postCartDeleteProduct = (req, res, next) => {
    const prodId = req.body.productId;
    req.user
        .removeFromCart(prodId)
        .then(result => {
            res.redirect('/cart');
        })
        .catch(err => console.log(err));
};

exports.postOrder = async (req, res, next) => {
    const DIVIDER_TEXT = '---------------------------------';
    const pdfdoc = new pdfkit();
    pdfdoc.fontSize(20).text('Order', { underline:true }).fontSize(14);
    const token = req.body.stripeToken;
    let totalSum = 0;

    const user = await req.user.populate('cart.items.productId');
    try {
        pdfdoc.text(`User email: ${user.email}`);
        pdfdoc.text('');

        const products = user.cart.items.map(i => {
            pdfdoc.text(`Product: ${i.productId.title} | Quantity: ${i.quantity}`).fontSize(16);
            return { quantity: i.quantity, product: { ...i.productId._doc } };
        });
        pdfdoc.text(DIVIDER_TEXT);

        user.cart.items.forEach(item => {
            totalSum += (item.quantity * (item.productId.discountedPrice || item.productId.price));
        });

        pdfdoc.text(`Total Charge: $${totalSum}`);

        const order = new Order({
            user: {
                email: req.user.email,
                userId: req.user
            },
            products: products
        });
        await order.save();
        
        const charge = stripe.charges.create({
            amount: totalSum * 100,
            currency: 'sgd',
            description: 'demo order',
            source: token,
            metadata: { order_id: order._id.str }
        });
        req.user.clearCart();
        pdfdoc.end();
        pdfdoc.pipe(fs.createWriteStream(`data/invoices/${order._id}.pdf`));
        
        res.redirect('/orders');
    } catch (ex) {
        next(new Error(err));
    };
};

exports.getOrders = (req, res, next) => {
    Order.find({ 'user.userId': req.user._id })
        .then(orders => {
            res.render('shop/orders', {
                path: '/orders',
                pageTitle: 'Your Orders',
                orders: orders,
            });
        })
        .catch(err => {
            next(new Error(err));
        });
};

exports.getInvoice = (req, res, next) => {
    Order.findOne({ _id: req.params.invoiceId })
        .then(order => {
            if (order.user.userId.str === req.user._id.str) {
                console.log(path.join(__dirname, '..', 'data', 'invoices', req.params.invoiceId) + '.pdf');
                res.sendFile(path.join(__dirname, '..', 'data', 'invoices', req.params.invoiceId) + '.pdf');
            }
        }).catch(err => {
            console.log('oh noes');
            next(new Error(err));
        })
};



exports.getCheckout = (req, res, next) => {
    req.user
        .populate('cart.items.productId')
        .execPopulate()
        .then(user => {
            const products = user.cart.items;
            let sum = 0;
            products.forEach(p => {
                sum += (p.quantity * (p.productId.discountedPrice || p.productId.price));
            });
            res.render('shop/checkout', {
                path: '/checkout',
                pageTitle: 'Checkout',
                products: products,
                totalSum: sum
            });
        })
        .catch(err => console.log(err));
};
