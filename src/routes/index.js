const { Router } = require('express');
const router = Router();

// Mount all domain routers
router.use('/', require('./auth'));
router.use('/', require('./me'));
router.use('/', require('./users'));
router.use('/', require('./games'));
router.use('/', require('./tournaments'));
router.use('/', require('./teams'));
router.use('/', require('./matches'));
router.use('/', require('./proposals'));
router.use('/', require('./notifications'));
router.use('/admin', require('./admin/index'));
router.use('/admin', require('./admin/tournaments'));

module.exports = router;
