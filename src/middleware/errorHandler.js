const { AppError } = require('../utils/AppError');

function errorHandler(err, req, res, next) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ success: false, error: err.message });
  }
  console.error('Unhandled error:', err);
  return res.status(500).json({ success: false, error: err.message || '服务器内部错误' });
}

module.exports = errorHandler;
