const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME || 'tgz44nig',
  api_key: process.env.CLOUD_API_KEY || '653697954716989',
  api_secret: process.env.CLOUD_API_SECRET || 'EHTt_IgcZ653m5gvahMg21_oCx0',
  secure: true
});

module.exports = cloudinary;
