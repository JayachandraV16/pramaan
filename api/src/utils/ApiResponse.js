// Standard JSON envelope for successful responses.
//
// Any `file_url` / `certificate_file_url` pointing at /uploads/... is replaced
// with a short-lived signed link on the way out, because /uploads is not
// publicly readable (see app.js).

const { signUploadPath } = require('./integrity');

const FILE_URL_KEYS = new Set(['file_url', 'certificate_file_url', 'fileUrl', 'certificateFileUrl']);

function signFileUrls(value) {
  if (Array.isArray(value)) return value.map(signFileUrls);
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    const out = {};
    for (const [key, val] of Object.entries(value)) {
      if (FILE_URL_KEYS.has(key) && typeof val === 'string' && val.startsWith('/uploads/') && !val.includes('?')) {
        out[key] = signUploadPath(val);
      } else {
        out[key] = signFileUrls(val);
      }
    }
    return out;
  }
  return value;
}

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
      data: signFileUrls(this.data),
    });
  }
}

module.exports = ApiResponse;
module.exports.signFileUrls = signFileUrls;
