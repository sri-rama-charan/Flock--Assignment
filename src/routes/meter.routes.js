const express = require('express');
const meterController = require('../controllers/meter.controller');

const router = express.Router();

// GET / - List or search meters with pagination
router.get('/', meterController.listMeters);

module.exports = router;
