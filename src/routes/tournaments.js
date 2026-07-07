const { Router } = require('express');
const { verifyToken } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/admin');
const prisma = require('../db');
const recalcTournamentCurrentTeams = require('../utils/recalcTournamentCurrentTeams');
const writeAdminLog = require('../utils/writeAdminLog');

const router = Router();

// ===== PUBLIC ROUTES =====

// GET /api/tournaments
router.get('/tournaments', async (_req, res) => {
  try {
    const tournaments = await prisma.tournament.findMany({
      include: { Game: true },
      orderBy: { TournamentName: 'asc' }
    });
    return res.json({ success: true, data: tournaments });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/tournaments/:tournamentId
router.get('/tournaments/:tournamentId', async (req, res) => {
  try {
    const { tournamentId } = req.params;
    const tournament = await prisma.tournament.findUnique({
      where: { TournamentID: tournamentId },
      include: {
        Game: true,
        SignUps: {
          include: {
            Team: {
              include: {
                Captain: { select: { UserID: true, UserName: true } }
              }
            }
          }
        },
        MatchInfos: {
          include: {
            MatchParticipations: {
              include: { Team: { select: { TeamID: true, TeamName: true } } },
              orderBy: { FinalRank: 'asc' }
            },
            ConfirmedProposal: true
          },
          orderBy: { MatchTime: 'asc' }
        }
      }
    });
    if (!tournament) return res.status(404).json({ success: false, error: '赛事不存在' });
    return res.json({ success: true, data: tournament });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ===== AUTHENTICATED ROUTES =====

// GET /api/tournaments/:tournamentId/roster
router.get('/tournaments/:tournamentId/roster', verifyToken, async (req, res) => {
  try {
    const { tournamentId } = req.params;
    const signUps = await prisma.signUp.findMany({
      where: { TournamentID: tournamentId },
      include: {
        Team: {
          select: { TeamID: true, TeamName: true, Captain: { select: { UserName: true } } }
        }
      }
    });
    const teams = signUps.map(s => s.Team);
    return res.json({ success: true, data: teams });
  } catch (error) {
    return res.status(400).json({ success: false, error: error.message });
  }
});

// POST /api/tournaments/:tournamentId/signup
router.post('/tournaments/:tournamentId/signup', verifyToken, async (req, res) => {
  try {
    const { tournamentId } = req.params;
    const { teamId } = req.body;
    if (!teamId) return res.status(400).json({ success: false, error: 'teamId 必填' });

    const userId = req.user.userId;
    const userTeam = await prisma.userTeam.findUnique({
      where: { UserID_TeamID: { UserID: userId, TeamID: teamId } }
    });
    if (!userTeam || !userTeam.IsCaptain) {
      return res.status(403).json({ success: false, error: '仅队长可报名队伍' });
    }

    const result = await prisma.$transaction(async (tx) => {
      const tour = await tx.tournament.findUnique({ where: { TournamentID: tournamentId } });
      const team = await tx.team.findUnique({ where: { TeamID: teamId } });
      if (!tour) throw new Error('赛事不存在');
      if (!team || team.DisbandedAt) throw new Error('队伍不存在');
      if (tour.GameID !== team.GameID) throw new Error('赛事与队伍项目不一致');
      if (tour.CurrentTeams >= tour.MaxTeamSize) throw new Error('赛事名额已满');

      await tx.signUp.create({ data: { TournamentID: tournamentId, TeamID: teamId } });
      const currentTeams = await recalcTournamentCurrentTeams(tx, tournamentId);
      return { tournamentId, teamId, currentTeams };
    });

    return res.status(201).json({ success: true, message: '报名成功', data: result });
  } catch (error) {
    return res.status(400).json({ success: false, error: error.message });
  }
});

// DELETE /api/tournaments/:tournamentId/signup/:teamId
router.delete('/tournaments/:tournamentId/signup/:teamId', verifyToken, async (req, res) => {
  try {
    const { tournamentId, teamId } = req.params;
    const userId = req.user.userId;

    const team = await prisma.team.findUnique({ where: { TeamID: teamId } });
    if (!team) return res.status(404).json({ success: false, error: '队伍不存在' });
    if (team.CaptainID !== userId && req.user.role !== 'administrator') {
      return res.status(403).json({ success: false, error: '无权取消报名' });
    }

    const tournament = await prisma.tournament.findUnique({ where: { TournamentID: tournamentId } });
    if (!tournament) return res.status(404).json({ success: false, error: '赛事不存在' });
    if (tournament.Status !== 'REGISTRATION') {
      return res.status(400).json({ success: false, error: '赛事已开始/结束，无法取消报名' });
    }

    const result = await prisma.$transaction(async (tx) => {
      await tx.signUp.delete({
        where: { TournamentID_TeamID: { TournamentID: tournamentId, TeamID: teamId } }
      });
      const currentTeams = await recalcTournamentCurrentTeams(tx, tournamentId);

      // 如果是管理员踢人，使用统一 helper 记录日志 (FIXED: use writeAdminLog with consistent casing)
      if (req.user.role === 'administrator') {
        await writeAdminLog(tx, {
          adminId: userId,
          module: 'Tournament',
          actionType: 'ADMIN_KICK_TEAM_FROM_TOURNAMENT',
          targetId: tournamentId,
          details: `Admin kicked team ${team.TeamName} (${teamId}) from tournament ${tournament.TournamentName}`
        });
      }

      return { tournamentId, teamId, currentTeams };
    });
    return res.json({ success: true, message: '已取消报名', data: result });
  } catch (error) {
    return res.status(400).json({ success: false, error: error.message });
  }
});

// GET /api/tournaments/:tournamentId/matches
router.get('/tournaments/:tournamentId/matches', verifyToken, async (req, res) => {
  const { tournamentId } = req.params;
  try {
    const matches = await prisma.matchInfo.findMany({
      where: { TournamentID: tournamentId },
      orderBy: { CreatedAt: 'desc' }
    });
    return res.json({ success: true, data: matches });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ===== ADMIN ROUTES =====

// POST /api/tournaments (create)
router.post('/tournaments', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { tournamentName, maxTeamSize, gameId, status, format, prizePool, description } = req.body;
    const operatorId = req.user.userId;

    const created = await prisma.$transaction(async (tx) => {
      const game = await tx.game.findUnique({ where: { GameID: gameId } });
      if (!game) throw new Error('关联的比赛项目不存在');

      const tournament = await tx.tournament.create({
        data: {
          TournamentName: tournamentName,
          MaxTeamSize: Number(maxTeamSize),
          GameID: gameId,
          Status: status || 'REGISTRATION',
          Format: format || null,
          PrizePool: prizePool || null,
          Description: description || null
        }
      });

      await writeAdminLog(tx, {
        adminId: operatorId,
        module: 'Tournament',
        actionType: 'CREATE_TOURNAMENT',
        targetId: tournament.TournamentID,
        details: `创建赛事: ${tournamentName}`
      });
      return tournament;
    });

    return res.status(201).json({ success: true, message: '赛事创建成功', data: created });
  } catch (error) {
    return res.status(400).json({ success: false, error: error.message });
  }
});

// PUT /api/tournaments/:tournamentId (update)
router.put('/tournaments/:tournamentId', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { tournamentId } = req.params;
    const operatorId = req.user.userId;
    const payload = req.body;

    const updated = await prisma.$transaction(async (tx) => {
      const tournament = await tx.tournament.update({
        where: { TournamentID: tournamentId },
        data: {
          TournamentName: payload.tournamentName,
          MaxTeamSize: payload.maxTeamSize ? Number(payload.maxTeamSize) : undefined,
          Status: payload.status,
          Format: payload.format,
          PrizePool: payload.prizePool,
          Description: payload.description
        }
      });

      await writeAdminLog(tx, {
        adminId: operatorId,
        module: 'Tournament',
        actionType: 'UPDATE_TOURNAMENT',
        targetId: tournamentId,
        details: `更新赛事参数: ${tournament.TournamentName}`
      });
      return tournament;
    });
    return res.json({ success: true, data: updated });
  } catch (error) {
    return res.status(400).json({ success: false, error: error.message });
  }
});

// DELETE /api/tournaments/:tournamentId (destroy)
router.delete('/tournaments/:tournamentId', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { tournamentId } = req.params;
    const operatorId = req.user.userId;

    await prisma.$transaction(async (tx) => {
      const tournament = await tx.tournament.findUnique({
        where: { TournamentID: tournamentId },
        select: { TournamentName: true }
      });

      if (!tournament) throw new Error('赛事不存在');

      const matches = await tx.matchInfo.findMany({
        where: { TournamentID: tournamentId },
        select: { MatchID: true }
      });

      for (const match of matches) {
        await tx.matchInfo.delete({ where: { MatchID: match.MatchID } });
      }

      await tx.signUp.deleteMany({ where: { TournamentID: tournamentId } });
      await tx.tournament.delete({ where: { TournamentID: tournamentId } });

      await writeAdminLog(tx, {
        adminId: operatorId,
        module: 'Tournament',
        actionType: 'DESTROY_TOURNAMENT',
        targetId: tournamentId,
        details: `彻底删除赛事: ${tournament.TournamentName}`
      });
    });

    return res.json({ success: true, message: '赛事已彻底删除' });
  } catch (error) {
    console.error('Error destroying tournament:', error);
    return res.status(400).json({ success: false, error: error.message });
  }
});

module.exports = router;
