const Router = require("express").Router();
const applyForInternship = require('../../../controllers/Internship/applyForInternship');

// POST /api/internship/apply - Apply for internship and get assessment link
Router.post("/apply", applyForInternship);

module.exports = Router;
