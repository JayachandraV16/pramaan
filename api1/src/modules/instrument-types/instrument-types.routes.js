const express = require('express');

const authenticate = require('../../middleware/authMiddleware');
const controller = require('./instrument-types.controller');

const router = express.Router();

router.use(authenticate);

router.get('/', controller.getInstrumentTypes);

module.exports = router;
