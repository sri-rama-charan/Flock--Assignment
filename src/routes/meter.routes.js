const express = require('express');
const meterController = require('../controllers/meter.controller');

const router = express.Router();

// GET / - List or search meters with pagination
router.get('/', meterController.listMeters);

// GET /:meterId/location - Retrieve location coordinates for a specific meter
router.get('/:meterId/location', meterController.getMeterLocation);

// GET /:meterId - Retrieve details for a specific meter
router.get('/:meterId', meterController.getMeterDetails);

module.exports = router;
