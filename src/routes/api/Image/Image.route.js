const Router = require("express").Router();
const { upload, uploadImage, deleteImage, getImageMetadata } = require('../../../../controllers/Image/uploadImage');

// Routes for image handling
Router.post("/upload", upload, uploadImage);
Router.delete("/:filePath", deleteImage);
Router.get("/:filePath/metadata", getImageMetadata);

module.exports = Router;

