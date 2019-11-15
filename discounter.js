const Product = require('./models/product');

const MAX_DISCOUNT_MINUTES = 14 /* days */ * 24 /* hours */ * 60 /* minutes */;

function discountProduct(p) {
    if (!p.updatedAt) {
        return;
    }

    const currentDate = new Date();
    const minutesElapsed = Math.ceil((currentDate - p.updatedAt) / 60000);
    const discountPercent = (minutesElapsed / MAX_DISCOUNT_MINUTES) * Math.max(0.5, Math.random());

    p.discountedPrice = Math.floor((1 - discountPercent) * p.price);
}

async function discountProducts() {
    const products = await Product.find();

    await Promise.all(products.map(p => {
        discountProduct(p);
        return p.save();
    }));
}

module.exports = {
    discountProduct,
    discountProducts
};
