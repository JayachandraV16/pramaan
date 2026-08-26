// api/src/modules/index.js
//
// Aggregates every module's router. In app.js you only need:
//   app.use('/api', require('./modules'));
//
// When a module goes from stub -> real implementation, nothing here needs
// to change — only the module's own routes.js file changes.

const express = require('express');

const authRoutes = require('./auth/auth.routes');
const instrumentsRoutes = require('./instruments/instruments.routes');
const applicationsRoutes = require('./applications/applications.routes');
const assignmentsRoutes = require('./assignments/assignments.routes');
const verificationsRoutes = require('./verifications/verifications.routes');
const certificatesRoutes = require('./certificates/certificates.routes');
const notificationsRoutes = require('./notifications/notifications.routes');
const schedulesRoutes = require('./schedules/schedules.routes');
const attachmentsRoutes = require('./attachments/attachments.routes');
const qrAuthRoutes = require('./qr-auth/qr-auth.routes');

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/instruments', instrumentsRoutes);
router.use('/applications', applicationsRoutes);
router.use('/assignments', assignmentsRoutes);
router.use('/verifications', verificationsRoutes);
router.use('/certificates', certificatesRoutes);
router.use('/notifications', notificationsRoutes);
router.use('/schedules', schedulesRoutes);
router.use('/attachments', attachmentsRoutes);
router.use('/qr-auth', qrAuthRoutes);

module.exports = router;
