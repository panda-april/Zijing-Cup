const { Router } = require('express');
const { verifyToken } = require('../../middleware/auth');
const { requireAdmin } = require('../../middleware/admin');
const prisma = require('../../db');

const router = Router();
router.use(verifyToken);
router.use(requireAdmin);

// GET /api/admin/stats — 管理员概览统计
router.get('/stats', async (_req, res) => {
  try {
    const [totalUsers, totalTeams, tournaments, pendingMatches] = await Promise.all([
      prisma.user.count(),
      prisma.team.count({ where: { DisbandedAt: null } }),
      prisma.tournament.findMany({ select: { Status: true } }),
      prisma.matchInfo.count({ where: { Status: { not: 'Finished' } } })
    ]);
    return res.json({
      success: true,
      data: {
        totalUsers,
        totalTeams,
        activeTournaments: tournaments.filter(t => t.Status !== 'COMPLETED').length,
        pendingMatches
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/admin/logs — 管理员日志查询
router.get('/logs', async (req, res) => {
  try {
    const limit = Number(req.query.limit || 100);
    const logs = await prisma.adminLog.findMany({
      take: Math.min(limit, 200),
      include: { Admin: { select: { UserID: true, UserName: true } } },
      orderBy: { CreatedAt: 'desc' }
    });
    return res.json({ success: true, data: logs });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
