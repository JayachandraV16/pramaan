// api/src/modules/reports/reports.routes.js
//
// Two routers from one module:
//   /api/dashboard/stats                 role-scoped counters for the dashboard
//   /api/reports/category-wise-approvals chart data (certificates by instrument type)
//   /api/reports/monthly-trends          last 6 months: submitted / approved / rejected
//   /api/reports/summary                 pendency, workload, divisions, expiry forecast
//   /api/reports/export/:dataset         CSV download (?from=YYYY-MM-DD&to=YYYY-MM-DD)
//                                        datasets: applications, certificates, verifications, instruments-due
// Everything is scoped to what the caller may see (see reports.repository.js).

const express = require('express');

const authenticate = require('../../middleware/authMiddleware');
const authorize = require('../../middleware/rbacMiddleware');
const asyncHandler = require('../../utils/asyncHandler');
const ApiResponse = require('../../utils/ApiResponse');
const { ROLES } = require('../../config/roles');
const service = require('./reports.service');

const reportRoles = [ROLES.ADMIN, ROLES.LMO, ROLES.GATC, ROLES.INSTRUMENT_OWNER];

const dashboardRouter = express.Router();
dashboardRouter.use(authenticate, authorize(...reportRoles));
dashboardRouter.get(
  '/stats',
  asyncHandler(async (req, res) => {
    new ApiResponse(200, await service.getDashboardStats(req.user)).send(res);
  })
);

const reportsRouter = express.Router();
reportsRouter.use(authenticate, authorize(...reportRoles));

reportsRouter.get(
  '/category-wise-approvals',
  asyncHandler(async (req, res) => {
    new ApiResponse(200, await service.getCategoryWiseApprovals(req.user)).send(res);
  })
);

reportsRouter.get(
  '/monthly-trends',
  asyncHandler(async (req, res) => {
    new ApiResponse(200, await service.getMonthlyTrends(req.user)).send(res);
  })
);

reportsRouter.get(
  '/summary',
  asyncHandler(async (req, res) => {
    new ApiResponse(200, await service.getSummary(req.user)).send(res);
  })
);

reportsRouter.get(
  '/export/:dataset',
  asyncHandler(async (req, res) => {
    // allow both /export/certificates and /export/certificates.csv
    const dataset = req.params.dataset.replace(/\.csv$/i, '');
    const { filename, csv } = await service.exportCsv(req.user, dataset, req.query);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).send(csv);
  })
);

module.exports = { dashboardRouter, reportsRouter };
