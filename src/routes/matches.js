const { Router } = require('express');
const { verifyToken } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/admin');
const prisma = require('../db');
const writeAdminLog = require('../utils/writeAdminLog');

const router = Router();

// ===== PUBLIC ROUTES =====

// GET /api/matches/recent — 已完赛的 H2H 比赛
router.get('/matches/recent', async (_req, res) => {
  try {
    const matches = await prisma.matchInfo.findMany({
      where: { Status: 'Finished', MatchType: 'H2H' },
      take: 10,
      orderBy: { MatchTime: 'desc' },
      include: {
        Tournament: { select: { TournamentName: true } },
        MatchParticipations: {
          include: { Team: { select: { TeamName: true } } },
          orderBy: { FinalRank: 'asc' }
        }
      }
    });
    const data = matches
      .filter(m => m.MatchParticipations.length >= 2)
      .map(m => {
        const [pA, pB] = m.MatchParticipations;
        return {
          id: m.MatchID,
          tournament: m.Tournament?.TournamentName || '',
          time: m.MatchTime ? new Date(m.MatchTime).toLocaleString('zh-CN') : '待定',
          teamA: pA?.Team?.TeamName || 'TBD',
          teamB: pB?.Team?.TeamName || 'TBD',
          scoreA: pA?.Score ?? null,
          scoreB: pB?.Score ?? null,
          winnerA: pA?.IsWinner ?? null
        };
      });
    return res.json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/matches/upcoming — 即将进行的比赛
router.get('/matches/upcoming', async (_req, res) => {
  try {
    const matches = await prisma.matchInfo.findMany({
      where: {
        Status: { not: 'Finished' },
        MatchTime: { not: null }
      },
      take: 10,
      orderBy: { MatchTime: 'asc' },
      include: {
        Tournament: { select: { TournamentName: true } },
        MatchParticipations: {
          include: { Team: { select: { TeamName: true } } }
        }
      }
    });
    const data = matches
      .filter(m => m.MatchParticipations.length >= 2 && m.MatchType === 'H2H')
      .map(m => {
        const [pA, pB] = m.MatchParticipations;
        return {
          id: m.MatchID,
          tournament: m.Tournament?.TournamentName || '',
          time: new Date(m.MatchTime).toLocaleString('zh-CN'),
          teamA: pA?.Team?.TeamName || 'TBD',
          teamB: pB?.Team?.TeamName || 'TBD',
          type: m.MatchType
        };
      });
    return res.json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/matches/history — 历史战绩
router.get('/matches/history', async (req, res) => {
  try {
    const game = req.query.game;
    const matches = await prisma.matchInfo.findMany({
      where: {
        Status: 'Finished',
        MatchType: 'H2H',
        ...(game ? { Tournament: { Game: { GameName: game } } } : {})
      },
      take: 50,
      orderBy: { MatchTime: 'desc' },
      include: {
        Tournament: {
          select: {
            TournamentName: true,
            Game: { select: { GameName: true } }
          }
        },
        MatchParticipations: {
          include: { Team: { select: { TeamName: true } } },
          orderBy: { FinalRank: 'asc' }
        }
      }
    });
    const data = matches
      .filter(m => m.MatchParticipations.length >= 2)
      .map(m => {
        const [pA, pB] = m.MatchParticipations;
        return {
          id: m.MatchID,
          tournament: m.Tournament?.TournamentName || '',
          game: m.Tournament?.Game?.GameName || '',
          date: m.MatchTime ? new Date(m.MatchTime).toLocaleDateString('zh-CN') : '未知',
          type: m.MatchType,
          teamA: pA?.Team?.TeamName || 'TBD',
          teamB: pB?.Team?.TeamName || 'TBD',
          scoreA: pA?.Score ?? null,
          scoreB: pB?.Score ?? null
        };
      });
    return res.json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ===== AUTHENTICATED ROUTE =====

// GET /api/matches/:matchId — 单场比赛详情
router.get('/matches/:matchId', verifyToken, async (req, res) => {
  try {
    const { matchId } = req.params;
    const match = await prisma.matchInfo.findUnique({
      where: { MatchID: matchId },
      include: {
        Tournament: { include: { Game: true } },
        MatchParticipations: {
          include: { Team: { select: { TeamID: true, TeamName: true, CaptainID: true, Captain: { select: { UserName: true } } } } },
          orderBy: { FinalRank: 'asc' }
        }
      }
    });
    if (!match) return res.status(404).json({ success: false, error: '比赛不存在' });
    return res.json({ success: true, data: match });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ===== ADMIN ROUTES =====

// PUT /api/matches/:matchId — 编辑比赛
router.put('/matches/:matchId', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { matchId } = req.params;
    const { matchName, matchType, matchTime, status, maxTeamAmount } = req.body;
    const operatorId = req.user.userId;

    const updated = await prisma.$transaction(async (tx) => {
      const match = await tx.matchInfo.update({
        where: { MatchID: matchId },
        data: {
          MatchName: matchName,
          MatchType: matchType,
          MatchTime: matchTime ? new Date(matchTime) : null,
          Status: status,
          MaxTeamAmount: maxTeamAmount ? Number(maxTeamAmount) : undefined
        }
      });
      await writeAdminLog(tx, {
        adminId: operatorId,
        module: 'Match',
        actionType: 'UPDATE_MATCH',
        targetId: matchId,
        details: `更新比赛: ${match.MatchName}`
      });
      return match;
    });
    return res.json({ success: true, data: updated });
  } catch (error) {
    return res.status(400).json({ success: false, error: error.message });
  }
});

// DELETE /api/matches/:matchId — 删除比赛
router.delete('/matches/:matchId', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { matchId } = req.params;
    const operatorId = req.user.userId;
    await prisma.$transaction(async (tx) => {
      await tx.matchInfo.delete({ where: { MatchID: matchId } });
      await writeAdminLog(tx, {
        adminId: operatorId,
        module: 'Match',
        actionType: 'DELETE_MATCH',
        targetId: matchId,
        details: `删除比赛 ${matchId}`
      });
    });
    return res.json({ success: true, message: '比赛已删除' });
  } catch (error) {
    return res.status(400).json({ success: false, error: error.message });
  }
});

// POST /api/matches/:matchId/results — 录入赛果（事务）
router.post('/matches/:matchId/results', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { matchId } = req.params;
    const { results } = req.body;
    const operatorId = req.user.userId;
    if (!Array.isArray(results) || results.length === 0) {
      return res.status(400).json({ success: false, error: 'results 不能为空' });
    }

    const updated = await prisma.$transaction(async (tx) => {
      for (const row of results) {
        const teamId = row.teamId || row.TeamID;
        if (!teamId) throw new Error('results[].teamId 必填');

        await tx.matchParticipation.upsert({
          where: { MatchID_TeamID: { MatchID: matchId, TeamID: teamId } },
          create: {
            MatchID: matchId,
            TeamID: teamId,
            Score: row.score !== undefined && row.score !== null && row.score !== '' ? Number(row.score) : null,
            FinalRank: row.rank !== undefined && row.rank !== null && row.rank !== '' ? Number(row.rank) : null,
            IsWinner: row.isWinner === undefined ? null : Boolean(row.isWinner),
            Status: row.status || 'Finished'
          },
          update: {
            Score: row.score !== undefined && row.score !== null && row.score !== '' ? Number(row.score) : null,
            FinalRank: row.rank !== undefined && row.rank !== null && row.rank !== '' ? Number(row.rank) : null,
            IsWinner: row.isWinner === undefined ? null : Boolean(row.isWinner),
            Status: row.status || 'Finished'
          }
        });
      }

      const match = await tx.matchInfo.update({
        where: { MatchID: matchId },
        data: { Status: 'Finished' }
      });

      await writeAdminLog(tx, {
        adminId: operatorId,
        module: 'Match',
        actionType: 'LOCK_RESULT',
        targetId: matchId,
        details: `锁定赛果: ${match.MatchName}`
      });

      return match;
    });

    return res.json({ success: true, message: '赛果已提交并锁定', data: updated });
  } catch (error) {
    return res.status(400).json({ success: false, error: error.message });
  }
});

// POST /api/tournaments/:tournamentId/matches — 创建比赛（管理员）
router.post('/tournaments/:tournamentId/matches', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { tournamentId } = req.params;
    const { matchName, maxTeamAmount, matchType, participants, matchTime, status } = req.body;
    const operatorId = req.user.userId;

    if (!matchName) return res.status(400).json({ success: false, error: 'matchName 必填' });

    const created = await prisma.$transaction(async (tx) => {
      const match = await tx.matchInfo.create({
        data: {
          MatchName: matchName,
          MaxTeamAmount: Number(maxTeamAmount || 2),
          TournamentID: tournamentId,
          MatchType: matchType || 'H2H',
          MatchTime: matchTime ? new Date(matchTime) : null,
          Status: status || 'Scheduling'
        }
      });

      if (Array.isArray(participants) && participants.length > 0) {
        await tx.matchParticipation.createMany({
          data: participants.map((teamId) => ({
            MatchID: match.MatchID,
            TeamID: teamId
          }))
        });

        for (const teamId of participants) {
          const team = await tx.team.findUnique({
            where: { TeamID: teamId },
            select: { CaptainID: true, TeamName: true }
          });
          if (team) {
            await tx.notification.create({
              data: {
                UserID: team.CaptainID,
                TeamID: teamId,
                MatchID: match.MatchID,
                Type: 'PENDING_MATCH',
                Title: '等待约赛',
                Description: `比赛 "${matchName}" - 队伍 "${team.TeamName}" 等待你安排约赛`
              }
            });
          }
        }
      }

      await writeAdminLog(tx, {
        adminId: operatorId,
        module: 'Match',
        actionType: 'CREATE_MATCH',
        targetId: match.MatchID,
        details: `创建比赛: ${match.MatchName}`
      });
      return match;
    });

    return res.status(201).json({ success: true, data: created });
  } catch (error) {
    return res.status(400).json({ success: false, error: error.message });
  }
});

module.exports = router;
