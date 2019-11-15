const path = require('path');

const express = require('express');
const bodyParser = require('body-parser');
const multer = require('multer');
const session = require('express-session');
const flash = require('connect-flash');

const MongoDBStore = require('connect-mongo')(session);
const mongoose = require('mongoose');

const errorController = require('./controllers/error');
const csurfController = require('./controllers/auth').csurfMiddleware;
const User = require('./models/user');

const MONGODB_URI = 'mongodb://shop:shop@localhost:27017/shop?ssl=true';

const app = express();
const store = new MongoDBStore({
    mongooseConnection: mongoose.connection
});

app.set('view engine', 'ejs');
app.set('views', 'views');

const adminRoutes = require('./routes/admin');
const shopRoutes = require('./routes/shop');
const authRoutes = require('./routes/auth');

const fileStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'images'); },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname); }
});

const fileFilter = (req, file, cb) => {
    switch (file.mimetype) {
        case 'image/png':
        case 'image/jpg':
        case 'image/jpeg':
            cb(null, true);
            break;
        default:
            cb(null, false);
            break;
    }
};

app.use(bodyParser.urlencoded({ extended: false }));
app.use(
    multer({ storage:fileStorage, fileFilter:fileFilter }).single('image')
    );

app.use(express.static(path.join(__dirname, 'public')));
app.use('/images', express.static(path.join(__dirname, 'images')));

app.use(
    session({
        secret: 'my secret',
        resave: false,
        saveUninitialized: false,
        store: store
    })
);

app.use(csurfController);
app.use(flash());
app.use((req, res, next) => {
    res.locals.isAuthenticated = req.session.isLoggedIn;
    res.locals.csrfToken = req.csrfToken();
    next();
});

app.use((req, res, next) => {
    if (!req.session.user) {
        console.log('Session.user does not exist');
        next();
    } else {
        console.log('Session has user associated');
        User.findById(req.session.user._id)
            .then(user => {
                if (user) {
                    req.user = user;
                }
                console.log("after session");
                next();

            }).catch(err => {
                next(new Error(err));
            });
    }
});

app.use('/admin', adminRoutes);
app.use(shopRoutes);
app.use(authRoutes);

// app.use('/500', errorController.get500)
app.use(errorController.get404);

app.use((error, req, res, next) => {
    console.log(error);
    res.status(error.httpStatusCode ? error.httpStatusCode : 500)
        .render('500', {
            errorCode: error.httpStatusCode ? error.httpStatusCode : 500,
            pageTitle: 'Error Occured!',
            path: error.httpStatusCode ? ('/' + error.httpStatusCode) : '/500',
            isAuthenticated: req.session && req.session.isLoggedIn,
            csrfToken: ''
        });
});


mongoose
    .connect(MONGODB_URI, { useNewUrlParser:true, sslCA:'/etc/ssl/mongodb.pem'})
    .then(result => {
        app.listen(3000);
    })
    .catch(err => {
        console.log(err);
    });
