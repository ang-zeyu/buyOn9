const path = require('path');
const fs = require('fs');
const { validationResult } = require('express-validator/check');

const Product = require('../models/product');
const { discountProduct } = require('../discounter');

exports.getAddProduct = (req, res, next) => {
    res.render('admin/edit-product', {
        pageTitle: 'Add Product',
        path: '/admin/add-product',
        editing: false,
        hasError: false,
        errorMessage: null,
        validationErrors: []
    });
};

exports.postAddProduct = (req, res, next) => {
    console.log("@postAddProduct");

    const title = req.body.title;
    const image = req.file;
    const price = req.body.price;
    const description = req.body.description;
    const errors = validationResult(req).array();

    if (!image) {
        return res.status(422)
            .render('admin/edit-product', {
                pageTitle: 'Add Product',
                path: '/admin/edit-product',
                editing: false,
                hasError: true,
                product: {
                    title: title,
                    price: price,
                    description: description
                },
                errorMessage: 'No valid image attached!',
                validationErrors: []
            });
    } else if (errors.length) {
        // console.log(errors);
        return res.status(422).render('admin/edit-product', {
            pageTitle: 'Add Product',
            path: '/admin/edit-product',
            editing: false,
            hasError: true,
            product: {
                title: title,
                price: price,
                description: description
            },
            errorMessage: errors[0].msg,
            validationErrors: errors
        });
    }

    const product = new Product({
        title: title,
        price: price,
        updatedAt: new Date(),
        description: description,
        imageUrl: '/' + image.path,
        userId: req.user
    });

    product.save()
        .then(result => {
            res.redirect('/admin/products');
        })
        .catch(err => {
            const error = (new Error(err));
            error.httpStatusCode = 422;
            next(error);
        });
};

exports.getEditProduct = (req, res, next) => {
    const editMode = req.query.edit;
    console.log(editMode);
    if (editMode === 'true') {
        const prodId = req.params.productId;
        Product.findById(prodId)
            .then(product => {
                if (!product) {
                    return res.redirect('/');
                }
                res.render('admin/edit-product', {
                    pageTitle: 'Edit Product',
                    path: '/admin/edit-product',
                    editing: editMode,
                    product: product,
                    hasError: false,
                    errorMessage: null,
                    validationErrors: []
                });
            })
            .catch(err => {
                const error = (new Error(err));
                error.httpStatusCode = 500;
                next(error);
            });
    } else {
        res.redirect('/');
    }
};

exports.postEditProduct = (req, res, next) => {
    console.log("@postEditProduct");
    const prodId = req.body.productId;
    const updatedTitle = req.body.title;
    const updatedPrice = req.body.price;
    const updatedImage = req.file;
    const updatedDesc = req.body.description;

    const errors = validationResult(req).array();

    if (errors.length) {
        return res.status(422).render('admin/edit-product', {
            pageTitle: 'Edit Product',
            path: '/admin/edit-product',
            editing: true,
            hasError: true,
            product: {
                title: updatedTitle,
                price: updatedPrice,
                description: updatedDesc,
                _id: prodId
            },
            errorMessage: errors[0].msg,
            validationErrors: errors
        });
    }

    Product.findById(prodId)
        .then(product => {
            const oldname = product.imageUrl.split('/')[2];
            if (product.userId.str !== req.user._id.str) {
                const error = (new Error(err));
                error.httpStatusCode = 403;
                return next(error);
            } else if (updatedImage) {
                product.imageUrl = '/' + updatedImage.path;
            }
            product.title = updatedTitle;
            product.price = updatedPrice;
            product.discountedPrice = 0;
            product.description = updatedDesc;
            product.updatedAt = new Date();

            return product.save()
                .then(result => {
                    console.log('UPDATED PRODUCT!');
                    
                    if (updatedImage) {
                        fs.unlink(path.join(__dirname, '..', 'images', oldname), (err) => {
                            next(new Error(err));
                        });
                    }

                    res.redirect('/admin/products');
                });
        }).catch(err => {
            const error = (new Error(err));
            error.httpStatusCode = 500;
            next(error);
        });
};

exports.getProducts = (req, res, next) => {
    Product.find(
        { userId: req.user._id }
    ).then(products => {
        console.log(products);
        res.render('admin/products', {
            prods: products,
            pageTitle: 'My Products',
            path: '/admin/products',
        });
    })
        .catch(err => {
            const error = (new Error(err));
            error.httpStatusCode = 500;
            next(error);
        });
};

exports.deleteProduct = (req, res, next) => {
    const prodId = req.body.productId;
    Product.findOneAndRemove({ userId:req.user._id, _id:prodId })
        .then(product => {
            console.log(`'Deleted Product'${product}`);

            fs.unlink(path.join(__dirname, '..', 'images', product.imageUrl.split('/')[2]), (err) => {
                next(new Error(err));
            });
            res.status(200).json({message:'product deletion success'});
        })
        .catch(err => {
            res.status(500).json({message:'product deletion failed'});
        });
};
