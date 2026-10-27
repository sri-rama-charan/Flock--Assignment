const express = require('express');
const meterController = require('../controllers/meter.controller');

const router = express.Router();

router.get('/', meterController.listMeters);
router.get('/:meterId/location', meterController.getMeterLocation);
router.get('/:meterId', meterController.getMeterDetails);

module.exports = router;
