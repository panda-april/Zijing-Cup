// 管理员权限守卫：仅 administrator 可访问后台接口
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'administrator') {
    return res.status(403).json({ success: false, error: '权限不足：仅管理员可操作' });
  }
  return next();
};

module.exports = { requireAdmin };
