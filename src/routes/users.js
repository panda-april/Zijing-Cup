const { Router } = require('express');
const { verifyToken } = require('../middleware/auth');
const prisma = require('../db');

const router = Router();

// GET /api/users/search — 招募雷达：按用户名模糊搜索
router.get('/users/search', verifyToken, async (req, res) => {
  try {
    const q = `${req.query.q || ''}`.trim();
    if (!q) return res.json({ success: true, data: [] });
    const users = await prisma.user.findMany({
      where: { UserName: { contains: q } },
      select: { UserID: true, UserName: true, Rank: true, MainRole: true },
      take: 10
    });
    return res.json({ success: true, data: users });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
