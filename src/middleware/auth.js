const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config');

// JWT 守卫：解析 Bearer token，把 { userId, role } 挂到 req.user
const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: '未登录，请提供有效的访问令牌 (Token)' });
  }

  const token = authHeader.split(' ')[1];
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    return next();
  } catch (_e) {
    return res.status(401).json({ success: false, error: '令牌已失效或不合法，请重新登录' });
  }
};

module.exports = { verifyToken };
