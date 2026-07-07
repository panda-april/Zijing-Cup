const { Router } = require('express');
const { verifyToken } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/admin');
const prisma = require('../db');

const router = Router();

// GET /api/games
router.get('/games', async (req, res) => {
  try {
    const activeOnly = req.query.activeOnly !== 'false';
    const games = await prisma.game.findMany({
      where: activeOnly ? { IsActive: true } : undefined,
      orderBy: { GameName: 'asc' }
    });
    return res.json({ success: true, data: games });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/games (admin)
router.post('/games', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { gameName, gameType } = req.body;
    if (!gameName) throw new Error('必须提供比赛项目名称');
    const newGame = await prisma.game.create({
      data: { GameName: gameName, GameType: gameType || null }
    });
    return res.status(201).json({ success: true, message: '比赛项目创建成功', data: newGame });
  } catch (error) {
    return res.status(400).json({ success: false, error: error.message });
  }
});

// PUT /api/games/:gameId/deactivate (admin)
router.put('/games/:gameId/deactivate', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { gameId } = req.params;
    const { isActive } = req.body;
    const game = await prisma.game.update({
      where: { GameID: gameId },
      data: { IsActive: typeof isActive === 'boolean' ? isActive : false }
    });
    return res.json({ success: true, data: game });
  } catch (error) {
    return res.status(400).json({ success: false, error: error.message });
  }
});

// DELETE /api/games/:gameId (admin)
router.delete('/games/:gameId', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { gameId } = req.params;

    const tournamentCount = await prisma.tournament.count({ where: { GameID: gameId } });
    if (tournamentCount > 0) {
      return res.status(400).json({
        success: false,
        error: `无法删除：该项目下仍有 ${tournamentCount} 个赛事，请先删除所有赛事`
      });
    }

    const teamCount = await prisma.team.count({ where: { GameID: gameId } });
    if (teamCount > 0) {
      return res.status(400).json({
        success: false,
        error: `无法删除：该项目下仍有 ${teamCount} 支队伍，请先解散队伍`
      });
    }

    await prisma.game.delete({ where: { GameID: gameId } });
    return res.json({ success: true, message: '项目已彻底删除' });
  } catch (error) {
    return res.status(400).json({ success: false, error: error.message });
  }
});

module.exports = router;
