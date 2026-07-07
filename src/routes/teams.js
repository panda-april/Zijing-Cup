const { Router } = require('express');
const { verifyToken } = require('../middleware/auth');
const prisma = require('../db');
const recalcTournamentCurrentTeams = require('../utils/recalcTournamentCurrentTeams');

const router = Router();

// ===== PUBLIC ROUTES =====

// GET /api/teams
router.get('/teams', async (_req, res) => {
  try {
    const teams = await prisma.team.findMany({
      where: { DisbandedAt: null },
      include: {
        Game: true,
        _count: { select: { Members: true } }
      },
      orderBy: { TeamName: 'asc' }
    });
    return res.json({ success: true, data: teams });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/teams/:teamId
router.get('/teams/:teamId', async (req, res) => {
  try {
    const { teamId } = req.params;
    const team = await prisma.team.findUnique({
      where: { TeamID: teamId },
      include: {
        Game: true,
        Captain: { select: { UserID: true, UserName: true } },
        Members: {
          include: { User: { select: { UserID: true, UserName: true, Rank: true, MainRole: true } } },
          orderBy: { JoinedAt: 'asc' }
        },
        SignUps: {
          include: { Tournament: { include: { Game: true } } }
        }
      }
    });
    if (!team || team.DisbandedAt) return res.status(404).json({ success: false, error: '队伍不存在' });
    return res.json({ success: true, data: team });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ===== AUTHENTICATED ROUTES =====

// POST /api/teams — 建队主流程（事务）
router.post('/teams', verifyToken, async (req, res) => {
  const { TeamName, GameName, TargetTournamentID, InitialInvites, Description } = req.body;
  const captainId = req.user.userId;

  try {
    if (!TeamName || !GameName) throw new Error('TeamName 和 GameName 必填');

    const data = await prisma.$transaction(async (tx) => {
      const game = await tx.game.findFirst({ where: { GameName, IsActive: true } });
      if (!game) throw new Error(`系统未收录游戏项目: ${GameName}`);

      const existingTeam = await tx.team.findFirst({
        where: { TeamName, DisbandedAt: null }
      });
      if (existingTeam) throw new Error('队名已存在，请更换');

      const newTeam = await tx.team.create({
        data: {
          TeamName,
          GameID: game.GameID,
          CaptainID: captainId,
          Description: Description || null
        }
      });

      await tx.userTeam.create({
        data: { UserID: captainId, TeamID: newTeam.TeamID, IsCaptain: true }
      });

      if (TargetTournamentID) {
        const tour = await tx.tournament.findUnique({ where: { TournamentID: TargetTournamentID } });
        if (!tour) throw new Error('目标赛事不存在');
        if (tour.GameID !== game.GameID) throw new Error('赛事项目与队伍项目不符，无法报名');

        await tx.signUp.create({
          data: { TournamentID: TargetTournamentID, TeamID: newTeam.TeamID }
        });
        await recalcTournamentCurrentTeams(tx, TargetTournamentID);
      }

      if (Array.isArray(InitialInvites) && InitialInvites.length > 0) {
        await tx.teamRequest.createMany({
          data: InitialInvites.map((targetId) => ({
            TeamID: newTeam.TeamID,
            TargetUserID: targetId,
            InitiatorID: captainId,
            Type: 'INVITE',
            Message: '队长在建队时向你发出了入队邀请！'
          }))
        });
      }

      return newTeam;
    });

    return res.status(201).json({ success: true, message: '队伍部署成功', data });
  } catch (error) {
    return res.status(400).json({ success: false, error: error.message });
  }
});

// POST /api/teams/:teamId/apply — 玩家申请入队
router.post('/teams/:teamId/apply', verifyToken, async (req, res) => {
  try {
    const { teamId } = req.params;
    const { message } = req.body;
    const userId = req.user.userId;

    const team = await prisma.team.findUnique({ where: { TeamID: teamId } });
    if (!team || team.DisbandedAt) return res.status(404).json({ success: false, error: '队伍不存在' });

    const existing = await prisma.teamRequest.findFirst({
      where: { TeamID: teamId, TargetUserID: userId, Status: 'PENDING' }
    });
    if (existing) return res.status(400).json({ success: false, error: '你已经发送过申请，请等待队长审核。' });

    const request = await prisma.teamRequest.create({
      data: {
        TeamID: teamId,
        TargetUserID: userId,
        InitiatorID: userId,
        Type: 'APPLY',
        Message: message || '请求加入队伍！'
      }
    });
    return res.json({ success: true, data: request });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/teams/:teamId/invite — 队长邀请 / 队员推荐
router.post('/teams/:teamId/invite', verifyToken, async (req, res) => {
  try {
    const { teamId } = req.params;
    const { targetUserId, message } = req.body;
    const initiatorId = req.user.userId;
    if (!targetUserId) return res.status(400).json({ success: false, error: 'targetUserId 必填' });

    const userTeam = await prisma.userTeam.findUnique({
      where: { UserID_TeamID: { UserID: initiatorId, TeamID: teamId } }
    });
    if (!userTeam) return res.status(403).json({ success: false, error: '你不在该队伍中，无权操作！' });

    const requestType = userTeam.IsCaptain ? 'INVITE' : 'RECOMMEND';
    const request = await prisma.teamRequest.create({
      data: {
        TeamID: teamId,
        TargetUserID: targetUserId,
        InitiatorID: initiatorId,
        Type: requestType,
        Message: message || (userTeam.IsCaptain ? '队长向你发出了直邀！' : '队员向队长推荐了你。')
      }
    });
    return res.json({ success: true, data: request });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/teams/requests/:requestId — 审批申请
router.put('/teams/requests/:requestId', verifyToken, async (req, res) => {
  try {
    const { requestId } = req.params;
    const { action } = req.body;
    const userId = req.user.userId;

    const request = await prisma.teamRequest.findUnique({ where: { RequestID: requestId } });
    if (!request) return res.status(404).json({ success: false, error: '请求不存在' });

    const team = await prisma.team.findUnique({ where: { TeamID: request.TeamID } });
    if (!team) return res.status(404).json({ success: false, error: '队伍不存在' });

    let hasPermission = false;
    if (request.Type === 'APPLY') {
      hasPermission = (team.CaptainID === userId);
    } else if (request.Type === 'RECOMMEND' || request.Type === 'INVITE') {
      hasPermission = (request.TargetUserID === userId);
    }

    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        error: request.Type === 'APPLY' ? '只有队长可以审批！' : '只有被邀请/被推荐者可以处理此请求！'
      });
    }

    if (!['APPROVE', 'REJECT'].includes(action)) {
      return res.status(400).json({ success: false, error: 'action 仅支持 APPROVE 或 REJECT' });
    }

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.teamRequest.update({
        where: { RequestID: requestId },
        data: {
          Status: action === 'APPROVE' ? 'APPROVED' : 'REJECTED',
          HandledAt: new Date(),
          HandledBy: userId
        }
      });

      if (request.Type === 'APPLY' && action === 'APPROVE') {
        const existingMember = await tx.userTeam.findUnique({
          where: { UserID_TeamID: { UserID: request.TargetUserID, TeamID: request.TeamID } }
        });
        if (!existingMember) {
          await tx.userTeam.create({
            data: { UserID: request.TargetUserID, TeamID: request.TeamID, IsCaptain: false }
          });
        }
      } else if (request.Type === 'RECOMMEND' && action === 'APPROVE') {
        await tx.teamRequest.create({
          data: {
            TeamID: request.TeamID,
            TargetUserID: request.TargetUserID,
            InitiatorID: request.InitiatorID,
            Type: 'APPLY',
            Message: `由 ${request.Initiator?.UserName || '队员'} 推荐，被推荐人已同意申请入队。`
          }
        });
      } else if (request.Type === 'INVITE' && action === 'APPROVE') {
        const existingMember = await tx.userTeam.findUnique({
          where: { UserID_TeamID: { UserID: request.TargetUserID, TeamID: request.TeamID } }
        });
        if (!existingMember) {
          await tx.userTeam.create({
            data: { UserID: request.TargetUserID, TeamID: request.TeamID, IsCaptain: false }
          });
        }
      }
      return updated;
    });

    return res.json({
      success: true,
      message: action === 'APPROVE' ? '已同意入队！' : '已拒绝该申请',
      data: result
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/teams/:teamId/leave — 队员退队
router.delete('/teams/:teamId/leave', verifyToken, async (req, res) => {
  try {
    const { teamId } = req.params;
    const userId = req.user.userId;

    const userTeam = await prisma.userTeam.findUnique({
      where: { UserID_TeamID: { UserID: userId, TeamID: teamId } }
    });
    if (!userTeam) return res.status(400).json({ success: false, error: '你不在该队伍中。' });
    if (userTeam.IsCaptain) return res.status(403).json({ success: false, error: '队长不能直接退出，请解散队伍。' });

    await prisma.userTeam.delete({
      where: { UserID_TeamID: { UserID: userId, TeamID: teamId } }
    });
    return res.json({ success: true, message: '已成功退出队伍。' });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/teams/:teamId/members/:targetId — 队长踢人
router.delete('/teams/:teamId/members/:targetId', verifyToken, async (req, res) => {
  try {
    const { teamId, targetId } = req.params;
    const captainId = req.user.userId;

    const team = await prisma.team.findUnique({ where: { TeamID: teamId } });
    if (!team) return res.status(404).json({ success: false, error: '队伍不存在' });
    if (team.CaptainID !== captainId) return res.status(403).json({ success: false, error: '无权操作' });
    if (captainId === targetId) return res.status(400).json({ success: false, error: '队长不能踢自己' });

    await prisma.userTeam.delete({
      where: { UserID_TeamID: { UserID: targetId, TeamID: teamId } }
    });
    return res.json({ success: true, message: '已将该成员移出队伍' });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/teams/:teamId — 更新队伍信息
router.put('/teams/:teamId', verifyToken, async (req, res) => {
  try {
    const { teamId } = req.params;
    const { Description } = req.body;
    const userId = req.user.userId;

    const team = await prisma.team.findUnique({ where: { TeamID: teamId } });
    if (!team || team.DisbandedAt) return res.status(404).json({ success: false, error: '队伍不存在' });
    if (team.CaptainID !== userId) return res.status(403).json({ success: false, error: '只有队长能修改队伍信息' });

    const updated = await prisma.team.update({
      where: { TeamID: teamId },
      data: { Description }
    });

    return res.json({ success: true, message: '队伍信息已更新', data: updated });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/teams/:teamId — 解散队伍（软删除）
router.delete('/teams/:teamId', verifyToken, async (req, res) => {
  try {
    const { teamId } = req.params;
    const captainId = req.user.userId;

    const result = await prisma.$transaction(async (tx) => {
      const team = await tx.team.findUnique({ where: { TeamID: teamId } });
      if (!team) throw new Error('队伍不存在');
      if (team.CaptainID !== captainId) throw new Error('只有队长能解散队伍');

      const signups = await tx.signUp.findMany({ where: { TeamID: teamId } });
      await tx.team.update({
        where: { TeamID: teamId },
        data: { DisbandedAt: new Date() }
      });

      for (const signup of signups) {
        await tx.signUp.delete({
          where: {
            TournamentID_TeamID: {
              TournamentID: signup.TournamentID,
              TeamID: signup.TeamID
            }
          }
        });
        await recalcTournamentCurrentTeams(tx, signup.TournamentID);
      }
      return { disbanded: true, affectedSignups: signups.length };
    });

    return res.json({ success: true, message: '队伍已解散', data: result });
  } catch (error) {
    return res.status(400).json({ success: false, error: error.message });
  }
});

// GET /api/teams/:teamId/requests — 查询队伍申请单
router.get('/teams/:teamId/requests', verifyToken, async (req, res) => {
  try {
    const { teamId } = req.params;
    const userId = req.user.userId;
    const status = req.query.status || 'PENDING';

    const team = await prisma.team.findUnique({ where: { TeamID: teamId } });
    if (!team) return res.status(404).json({ success: false, error: '队伍不存在' });
    if (team.CaptainID !== userId) return res.status(403).json({ success: false, error: '仅队长可查看申请列表' });

    const requests = await prisma.teamRequest.findMany({
      where: {
        TeamID: teamId,
        Status: status,
        Type: 'APPLY'
      },
      include: {
        TargetUser: { select: { UserID: true, UserName: true, Rank: true, MainRole: true } },
        Initiator: { select: { UserID: true, UserName: true } }
      },
      orderBy: { CreatedAt: 'desc' }
    });
    return res.json({ success: true, data: requests });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
