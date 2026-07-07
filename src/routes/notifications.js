const { Router } = require('express');
const { verifyToken } = require('../middleware/auth');
const prisma = require('../db');

const router = Router();

// GET /api/notifications — 获取当前用户所有通知
router.get('/notifications', verifyToken, async (req, res) => {
  const userId = req.user.userId;
  try {
    const notifications = await prisma.notification.findMany({
      where: { UserID: userId },
      orderBy: { CreatedAt: 'desc' }
    });
    return res.json({ success: true, data: notifications });
  } catch (error) {
    return res.status(400).json({ success: false, error: error.message });
  }
});

// POST /api/notifications/:id/read — 标记通知已读
router.post('/notifications/:id/read', verifyToken, async (req, res) => {
  const userId = req.user.userId;
  const notificationId = req.params.id;
  try {
    await prisma.notification.update({
      where: { NotificationID: notificationId },
      data: { IsRead: true }
    });
    return res.json({ success: true, message: '标记已读成功' });
  } catch (error) {
    return res.status(400).json({ success: false, error: error.message });
  }
});

module.exports = router;
