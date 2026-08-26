// api/src/modules/auth/auth.controller.js

const asyncHandler = require('../../utils/asyncHandler');
const ApiResponse = require('../../utils/ApiResponse');
const service = require('./auth.service');

const register = asyncHandler(async (req, res) => {
  const result = await service.register(req.body);
  new ApiResponse(201, result, 'User registered successfully').send(res);
});

const login = asyncHandler(async (req, res) => {
  const result = await service.login(req.body);
  new ApiResponse(200, result, 'Login successful').send(res);
});

const me = asyncHandler(async (req, res) => {
  const user = await service.getProfile(req.user.id);
  new ApiResponse(200, user).send(res);
});

module.exports = { register, login, me };
