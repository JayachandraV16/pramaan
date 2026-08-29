// api/src/utils/ApiResponse.js
//
// Standard success response shape, so every module returns the same JSON
// envelope: { success, message, data }. Error shape is handled separately
// by errorHandler.js.

class ApiResponse {
  constructor(statusCode, data = null, message = 'Success') {
    this.success = statusCode < 400;
    this.statusCode = statusCode;
    this.message = message;
    this.data = data;
  }

  send(res) {
    return res.status(this.statusCode).json({
      success: this.success,
      message: this.message,
      data: this.data,
    });
  }
}

module.exports = ApiResponse;
