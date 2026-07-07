const { Router } = require('express');
const { verifyToken } = require('../../middleware/auth');
const { requireAdmin } = require('../../middleware/admin');
const prisma = require('../../db');
const recalcTournamentCurrentTeams = require('../../utils/recalcTournamentCurrentTeams');
const writeAdminLog = require('../../utils/writeAdminLog');

const router = Router();
router.use(verifyToken);
router.use(requireAdmin);

// GET /api/admin/tournaments/:tournamentId/search-teams
router.get('/tournaments/:tournamentId/search-teams', async (req, res) => {
  try {
    const { tournamentId } = req.params;
    const { query } = req.query;
    const trimmedQuery = (query || '').trim();

    const tournament = await prisma.tournament.findUnique({
      where: { TournamentID: tournamentId },
      select: { GameID: true }
    });
    if (!tournament) {
      return res.status(404).json({ success: false, error: '赛事不存在' });
    }

    const signedUp = await prisma.signUp.findMany({
      where: { TournamentID: tournamentId },
      select: { TeamID: true }
    });
    const signedUpIds = signedUp.map(s => s.TeamID);

    const teams = await prisma.team.findMany({
      where: {
        GameID: tournament.GameID,
        DisbandedAt: null,
        TeamID: { notIn: signedUpIds },
        TeamName: { contains: trimmedQuery }
      },
      select: { TeamID: true, TeamName: true, Captain: { select: { UserName: true } } },
      take: 20,
      orderBy: { TeamName: 'asc' }
    });

    return res.json({ success: true, data: teams });
  } catch (error) {
    return res.status(400).json({ success: false, error: error.message });
  }
});

// POST /api/admin/tournaments/:tournamentId/add-team
router.post('/tournaments/:tournamentId/add-team', async (req, res) => {
  try {
    const { tournamentId } = req.params;
    const { teamId } = req.body;

    const tournament = await prisma.tournament.findUnique({ where: { TournamentID: tournamentId } });
    if (!tournament) {
      return res.status(404).json({ success: false, error: '赛事不存在' });
    }

    const team = await prisma.team.findUnique({ where: { TeamID: teamId } });
    if (!team) {
      return res.status(404).json({ success: false, error: '队伍不存在' });
    }

    const existing = await prisma.signUp.findUnique({
      where: { TournamentID_TeamID: { TournamentID: tournamentId, TeamID: teamId } }
    });
    if (existing) {
      return res.status(400).json({ success: false, error: '该队伍已报名' });
    }

    if (tournament.CurrentTeams >= tournament.MaxTeamSize) {
      return res.status(400).json({ success: false, error: '赛事已达到最大队伍数' });
    }

    const result = await prisma.$transaction(async (tx) => {
      await tx.signUp.create({
        data: { TournamentID: tournamentId, TeamID: teamId }
      });
      const currentTeams = await recalcTournamentCurrentTeams(tx, tournamentId);

      // 记录管理员日志 (FIXED: moved inside transaction)
      await writeAdminLog(tx, {
        adminId: req.user.userId,
        module: 'Tournament',
        actionType: 'ADMIN_ADD_TEAM_TO_TOURNAMENT',
        targetId: tournamentId,
        details: `Admin added team ${team.TeamName} (${teamId}) to tournament ${tournament.TournamentName}`
      });

      return { currentTeams };
    });

    return res.json({ success: true, message: '添加成功', data: result });
  } catch (error) {
    return res.status(400).json({ success: false, error: error.message });
  }
});

module.exports = router;
