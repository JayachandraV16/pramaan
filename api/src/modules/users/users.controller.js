// api/src/modules/users/users.controller.js

const asyncHandler = require('../../utils/asyncHandler');
const ApiResponse = require('../../utils/ApiResponse');
const service = require('./users.service');

const listUsers = asyncHandler(async (req, res) => {
  new ApiResponse(200, await service.listUsers(req.query)).send(res);
});

const getUser = asyncHandler(async (req, res) => {
  new ApiResponse(200, await service.getUser(req.params.id)).send(res);
});

const createUser = asyncHandler(async (req, res) => {
  const user = await service.createUser(req.user, req.body);
  new ApiResponse(201, user, 'User created').send(res);
});

const updateStatus = asyncHandler(async (req, res) => {
  const user = await service.updateStatus(req.user, req.params.id, req.body.status);
  new ApiResponse(200, user, 'User status updated').send(res);
});

const updateOwnProfile = asyncHandler(async (req, res) => {
  const user = await service.updateOwnProfile(req.user.id, req.body);
  new ApiResponse(200, user, 'Profile updated').send(res);
});

const changeOwnPassword = asyncHandler(async (req, res) => {
  await service.changeOwnPassword(req.user.id, req.body);
  new ApiResponse(200, null, 'Password changed').send(res);
});

module.exports = {
  listUsers,
  getUser,
  createUser,
  updateStatus,
  updateOwnProfile,
  changeOwnPassword,
};
