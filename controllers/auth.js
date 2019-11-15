const User = require('../models/user');
const bcrypt = require('bcryptjs');
const csurf = require('csurf');
const crypto = require('crypto');
const { validationResult } = require('express-validator/check');

const nodemailer = require('nodemailer');
const sendTrans = require('nodemailer-sendgrid-transport');

const transporter = nodemailer.createTransport(
    sendTrans({
        auth: {
            api_key: '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'
        }
    })
);

exports.csurfMiddleware = csurf();

exports.getLogin = (req, res, next) => {
    res.render('auth/login', {
        path: '/login',
        pageTitle: 'Login',
        errorMessage: req.flash('error'),
        errors:[],
        oldInput: {
            email:'',
            password: ''
        }
    });
};

exports.getSignup = (req, res, next) => {
    res.render('auth/signup', {
        path: '/signup',
        pageTitle: 'Signup',
        errorMessage: req.flash('error'),
        errors:[],
        oldInput:{
            email: '',
            password: '',
            confirmPassword: ''
        }
    });
};

exports.postSignup = (req, res, next) => {
    const errors = validationResult(req).array();

    if (errors.length) {
        // console.log(errors.array());
        return res.status(422).render('auth/signup', {
            path: '/signup',
            pageTitle: 'Signup',
            errorMessage: errors[0].msg,
            errors: errors,
            oldInput:{
                email: req.body.email,
                password: req.body.password,
                confirmPassword: req.body.confirmPassword
            }
            });
    }

    bcrypt.hash(req.body.password, 10)
        .then(hashedPW => {
            return (new User({ email:req.body.email, password:hashedPW, cart: { items:[] } }))
                .save(err => { console.log(err); });
        }).then(msg => {
            transporter.sendMail({
                to: req.body.email,
                from:"nodeSendMail@node-complete.com",
                subject:'Signup Successful',
                html:"<div>You successfully signed up!</div>"
            });

            res.redirect('/login');
        }).catch(err => {
            const error = (new Error(err));
            error.httpStatusCode = 500;
            next(error);
        });
};

exports.postLogin = (req, res, next) => {
    const errors = validationResult(req).array();

    if (errors.length) {
        console.log(errors);
        return res.status(422).render('auth/login', {
            path: '/login',
            pageTitle: 'Login',
            errorMessage: errors[0].msg,
            errors: errors,
            oldInput:{
                email: req.body.email,
                password: req.body.password
            }
        });
    }

    User.findOne({ email:req.body.email })
        .then(user => {
            if (!user) {
                req.flash('error', 'Invalid email or password');
                res.redirect('/login');
            } else {
                bcrypt.compare(req.body.password, user.password)
                    .then(isUser => {
                        if (isUser) {
                            req.session.isLoggedIn = true;
                            req.session.user = user;
                            return req.session.save(err => {
                                console.log(err);
                                res.redirect('/');
                            });
                        } else {
                            req.flash('error', 'Invalid email or password');
                            res.redirect('/login');
                        }
                    }).catch(err => {
                        console.log(err);
                        res.redirect('/login');
                    })

            }
        })
        .catch(err => {
            const error = (new Error(err));
            error.httpStatusCode = 500;
            next(error);
        });
};

exports.postLogout = (req, res, next) => {
    req.session.destroy(err => {
        console.log(err);
        res.redirect('/');
    });
};

exports.getReset = (req, res, next) => {
    res.render('auth/reset', {
        path: '/reset',
        pageTitle: 'Reset Password',
        errorMessage: req.flash('error')
    });

};

exports.postReset = (req, res, next) => {
    crypto.randomBytes(32, (err, buffer) => {
        if (err) {
            console.log(err);
            req.flash('error', 'Please try again');
            res.redirect('/reset');
        }

        const token = buffer.toString('hex');
        User.findOne({email: req.body.email})
            .then(user => {
                if (!user) {
                    req.flash('error', 'No account with email found');
                    res.redirect('/');
                } else {
                    user.resetToken = token;
                    user.resetTokenExpiration = Date.now() + 3600000;
                    return user.save();
                }
            }).then(result => {
                console.log('sending password reset mail');
                transporter.sendMail({
                    to:req.body.email,
                    from:"nodeSendMail@node-complete.com",
                    subject:'Password Reset',
                    html:`
                        <p>You requested a password reset!</p>
                        <p>Click this link to set a new password which is only valid for an hour.</p>
                        <a href="http://localhost:3000/new-password/${token}">Click to reset password</a>`
                });

                res.redirect('/');
            }).catch(err => {
                const error = (new Error(err));
                error.httpStatusCode = 500;
                next(error);
            });
    });
};

exports.getNewPassword = (req, res, next) => {
    const token = req.params.token;
    User.findOne({resetToken:token, resetTokenExpiration:{$gt: Date.now()}})
        .then(usr => {
            if (usr) {
                res.render('auth/new-password', {
                    path: '/new-password',
                    pageTitle: 'Create new password',
                    errorMessage: false,
                    userToken: token,
                    userId: usr._id
                });
            } else {
                res.render('auth/new-password', {
                    path: '/new-password',
                    pageTitle: 'Create new password',
                    errorMessage: 'Error: Expired or invalid reset token'
                });
            }
            // req.flash('user', token);
        }).catch(err => {
            const error = (new Error(err));
            error.httpStatusCode = 500;
            next(error);
        })

};

exports.postNewPassword = (req, res, next) => {
    // const token = req.flash('user');
    let usr;

    // if (token) {
    User.findOne({resetToken:req.body.q1w2e3r4t5, _id:req.body.q1w2e3r4t9, resetTokenExpiration:{$gt: Date.now()}})
        .then(usrFound => {
            if (usrFound) {
                usr = usrFound;
                return bcrypt.hash(req.body.password, 12);
            } else {
                res.redirect('/new-password');
            }
        }).then(hashedPW => {
            usr.resetToken = undefined;
            usr.resetTokenExpiration = undefined;
            usr.password = hashedPW;

            return usr.save();
        }).then(msg => {
            res.redirect('/login');
        }).catch(err => {
            const error = (new Error(err));
            error.httpStatusCode = 500;
            next(error);
        });
    // } else {
    //     res.redirect('/');
    // }
};
