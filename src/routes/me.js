const { Router } = require('express');
const bcrypt = require('bcryptjs');
const prisma = require('../db');
const { verifyToken } = require('../middleware/auth');
const { getDashboard } = require('../services/teamDashboardService');

const router = Router();

// PUT /me/profile — Update user profile
router.put('/me/profile', verifyToken, async (req, res) => {
  const { rank, mainRole, intro, oldPassword, newPassword } = req.body;
  const userId = req.user.userId;
  try {
    // 获取当前用户信息
    const user = await prisma.user.findUnique({ where: { UserID: userId } });
    if (!user) throw new Error('用户不存在');

    // 如果要修改密码，必须验证旧密码
    if (newPassword) {
      if (!oldPassword) throw new Error('修改密码需要提供原密码');
      const ok = await bcrypt.compare(oldPassword, user.PasswordHash);
      if (!ok) throw new Error('原密码错误');
      if (newPassword.length < 6) throw new Error('新密码长度至少6位');
    }

    // 准备更新数据
    const updateData = {
      Rank: rank !== undefined ? rank : user.Rank,
      MainRole: mainRole !== undefined ? mainRole : user.MainRole,
      Intro: intro !== undefined ? intro : user.Intro,
    };

    // 如果有新密码，更新密码哈希
    if (newPassword) {
      updateData.PasswordHash = await bcrypt.hash(newPassword, await bcrypt.genSalt(10));
    }

    // 更新数据库
    const updated = await prisma.user.update({
      where: { UserID: userId },
      data: updateData
    });

    const { PasswordHash, ...safe } = updated;
    return res.json({ success: true, message: '个人信息更新成功', data: safe });
  } catch (error) {
    return res.status(400).json({ success: false, error: error.message });
  }
});

// GET /me/profile — Get user profile
router.get('/me/profile', verifyToken, async (req, res) => {
  const userId = req.user.userId;
  try {
    const user = await prisma.user.findUnique({ where: { UserID: userId } });
    if (!user) throw new Error('用户不存在');
    const { PasswordHash, ...safe } = user;
    return res.json({ success: true, data: safe });
  } catch (error) {
    return res.status(400).json({ success: false, error: error.message });
  }
});

// GET /me/team-dashboard — Team dashboard
router.get('/me/team-dashboard', verifyToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const shaped = await getDashboard(prisma, userId);
    return res.json({ success: true, data: shaped });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// GET /me/captain-teams/:gameId — Captain teams for a specific game
router.get('/me/captain-teams/:gameId', verifyToken, async (req, res) => {
  try {
    const { gameId } = req.params;
    const userId = req.user.userId;

    // 查询：当前用户是队长，队伍未解散，并且 GameID 匹配赛事项目
    const teams = await prisma.team.findMany({
      where: {
        CaptainID: userId,
        DisbandedAt: null,
        GameID: gameId
      },
      select: {
        TeamID: true,
        TeamName: true,
        Game: { select: { GameName: true } },
        _count: { select: { Members: true } }
      },
      orderBy: { CreatedAt: 'desc' }
    });

    return res.json({ success: true, data: teams });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// GET /me/teams — Get current user's teams
router.get('/me/teams', verifyToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    // 查询当前用户参与的所有队伍
    const userTeams = await prisma.userTeam.findMany({
      where: { UserID: userId },
      include: {
        Team: {
          select: {
            TeamID: true,
            TeamName: true,
            GameID: true,
            Game: { select: { GameName: true } },
            CaptainID: true,
            DisbandedAt: true
          }
        }
      }
    });

    // 整理数据，添加 isCaptain 字段
    const teams = userTeams.map(ut => ({
      TeamID: ut.Team.TeamID,
      TeamName: ut.Team.TeamName,
      GameID: ut.Team.GameID,
      GameName: ut.Team.Game.GameName,
      isCaptain: ut.IsCaptain,
      disbanded: ut.Team.DisbandedAt !== null
    })).filter(t => !t.disbanded); // 只返回未解散队伍

    return res.json({ success: true, data: teams });
  } catch (error) {
    console.error('Error in GET /api/me/teams:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// GET /me/notifications/requests — Pending team requests for the current user
router.get('/me/notifications/requests', verifyToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    // 只查询当前用户**需要处理**的请求：
    // - APPLY: 需要队长处理 → Team.CaptainID = userId
    // - INVITE / RECOMMEND: 需要被邀请/被推荐者处理 → TargetUserID = userId
    const requests = await prisma.teamRequest.findMany({
      where: {
        Status: 'PENDING',
        OR: [
          // INVITE / RECOMMEND: 用户是被邀请/被推荐者，需要用户处理
          { AND: [{ Type: { in: ['INVITE', 'RECOMMEND'] } }, { TargetUserID: userId }] },
          // APPLY: 用户是队长，需要队长处理
          { AND: [{ Type: 'APPLY' }, { Team: { CaptainID: userId } }] }
        ]
      },
      include: {
        Team: { select: { TeamID: true, TeamName: true } },
        TargetUser: { select: { UserID: true, UserName: true } },
        Initiator: { select: { UserName: true } }
      },
      orderBy: { CreatedAt: 'desc' }
    });

    const shaped = requests.map(r => ({
      requestId: r.RequestID,
      teamId: r.TeamID,
      teamName: r.Team.TeamName,
      type: r.Type, // APPLY / INVITE / RECOMMEND
      userName: r.TargetUser.UserName,
      message: r.Message,
      createdAt: r.CreatedAt,
      isInitiator: r.InitiatorUserID === userId,
      initiatorName: r.Initiator?.UserName || ''
    }));

    return res.json({ success: true, data: shaped });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// GET /me/upcoming-matches — Upcoming matches for the current user's teams
router.get('/me/upcoming-matches', verifyToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    // 查询当前用户参与的所有队伍（无论是否队长）
    const userTeams = await prisma.userTeam.findMany({
      where: { UserID: userId },
      select: { TeamID: true }
    });

    const teamIds = userTeams.map(ut => ut.TeamID);

    if (teamIds.length === 0) {
      return res.json({ success: true, data: [] });
    }

    // 查询这些队伍参与的比赛中：比赛时间已确定，且所有参赛队伍都还没有录入赛果
    const matches = await prisma.matchInfo.findMany({
      where: {
        MatchTime: { not: null }, // 时间已确定
        MatchParticipations: {
          some: { TeamID: { in: teamIds } }
        },
        // 至少有一支队伍（用户的队伍）还没有成绩
        AND: {
          MatchParticipations: {
            some: {
              TeamID: { in: teamIds },
              Score: null
            }
          }
        }
      },
      include: {
        Tournament: { select: { TournamentID: true, TournamentName: true } },
        MatchParticipations: { include: { Team: { select: { TeamName: true } } } }
      },
      orderBy: { MatchTime: 'asc' }
    });

    // 整理数据，只保留用户队伍所在参赛信息
    const shaped = matches.map(match => {
      // 用户的队伍在这场比赛中的参赛记录
      const myParticipants = match.MatchParticipations.filter(mp => teamIds.includes(mp.TeamID));
      // 其他队伍（对手）
      const otherParticipants = match.MatchParticipations.filter(mp => !teamIds.includes(mp.TeamID));

      return {
        matchId: match.MatchID,
        tournamentId: match.Tournament?.TournamentID || null,
        tournamentName: match.Tournament?.TournamentName || 'Unknown Tournament',
        matchName: match.MatchName,
        matchType: match.MatchType,
        matchTime: match.MatchTime,
        status: match.Status,
        myTeams: myParticipants.map(mp => ({
          teamId: mp.TeamID,
          teamName: mp.Team?.TeamName || 'Unknown',
          score: mp.Score,
          isWinner: mp.IsWinner
        })),
        opponentTeams: otherParticipants.map(mp => ({
          teamId: mp.TeamID,
          teamName: mp.Team?.TeamName || 'Unknown',
          score: mp.Score,
          isWinner: mp.IsWinner
        }))
      };
    });

    return res.json({ success: true, data: shaped });
  } catch (error) {
    console.error('Error in GET /api/me/upcoming-matches:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
