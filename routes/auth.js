const express = require('express');
const { check, body } = require('express-validator/check');

const User = require('../models/user');
const authController = require('../controllers/auth');

const router = express.Router();

router.get('/login', authController.getLogin);

router.get('/signup', authController.getSignup);

router.get('/reset', authController.getReset);

router.get('/new-password/:token', authController.getNewPassword);

router.post('/login',
    body('email').isEmail().withMessage('Email is invalid'),
    body('password').isAlphanumeric().isLength({ min:5 }).withMessage('Password is invalid'),
    authController.postLogin);

router.post('/signup',
    check('email', 'Please enter a valid email!').isEmail()
        .custom((val, {req}) => {
            return User.findOne({ email:val })
                .then(usr => {
                    if (usr) {
                        return Promise.reject("Email already exists!");
                    }
                    });
                }),
    body('password', 'Please enter an alphanumeric password at least 5 characters long.').isAlphanumeric().isLength({min:5}),
    body('confirmPassword').custom((val, {req}) => {
        if (val === req.body.password ) { return true; }
        else { throw new Error('Passwords must match!'); }}),
    authController.postSignup);

router.post('/logout', authController.postLogout);

router.post('/reset', authController.postReset);

router.post('/new-password', authController.postNewPassword);

module.exports = router;
