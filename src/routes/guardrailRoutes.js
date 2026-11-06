'use strict';

const express = require('express');
const router = express.Router();
const { checkGuardrails } = require('../controllers/guardrailController');

// POST /api/guardrails/check
router.post('/check', checkGuardrails);

module.exports = router;

