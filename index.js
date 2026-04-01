const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = 'ZiJingCup_Super_Secret_Key_2026';
const app = express();

app.use(cors());
app.use(express.json());

const adapter = new PrismaBetterSqlite3({ url: 'file:./dev.db' });
const prisma = new PrismaClient({ adapter });

// JWT 守卫：解析 Bearer token，把 { userId, role } 挂到 req.user
const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: '未登录，请提供有效的访问令牌 (Token)' });
  }

  const token = authHeader.split(' ')[1];
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    return next();
  } catch (_e) {
    return res.status(401).json({ success: false, error: '令牌已失效或不合法，请重新登录' });
  }
};

// 管理员权限守卫：仅 administrator 可访问后台接口
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'administrator') {
    return res.status(403).json({ success: false, error: '权限不足：仅管理员可操作' });
  }
  return next();
};

// 统一口径：每次报名/退赛后都以 SignUp 实际数量回写 CurrentTeams，保证强一致
const recalcTournamentCurrentTeams = async (tx, tournamentId) => {
  const count = await tx.signUp.count({ where: { TournamentID: tournamentId } });
  await tx.tournament.update({
    where: { TournamentID: tournamentId },
    data: { CurrentTeams: count }
  });
  return count;
};

// 管理员日志统一写入函数，避免重复拼装字段
const writeAdminLog = async (tx, { adminId, module, actionType, targetId, details }) => {
  return tx.adminLog.create({
    data: {
      AdminID: adminId || null,
      Module: module || null,
      ActionType: actionType,
      TargetID: targetId,
      Details: details
    }
  });
};

// ==========================================
// Public APIs
// ==========================================
// 服务健康检查
app.get('/ping', (_req, res) => {
  res.send('紫荆杯后端服务已启动，Pong!');
});

app.post('/api/users/register', async (req, res) => {
  const { userName, password, role, rank, mainRole, intro } = req.body;
  try {
    if (!userName || !password) throw new Error('用户名和密码不能为空');
    const existing = await prisma.user.findUnique({ where: { UserName: userName } });
    if (existing) throw new Error('该用户名已被注册');

    const hashed = await bcrypt.hash(password, await bcrypt.genSalt(10));
    const newUser = await prisma.user.create({
      data: {
        UserName: userName,
        PasswordHash: hashed,
        UserRole: role || 'audience',
        Rank: rank || null,
        MainRole: mainRole || null,
        Intro: intro || null
      }
    });

    const { PasswordHash, ...safe } = newUser;
    return res.status(201).json({ success: true, message: '用户创建成功', data: safe });
  } catch (error) {
    return res.status(400).json({ success: false, error: error.message });
  }
});

app.post('/api/users/login', async (req, res) => {
  const { userName, password } = req.body;
  try {
    if (!userName || !password) throw new Error('用户名和密码不能为空');
    const user = await prisma.user.findUnique({ where: { UserName: userName } });
    if (!user) throw new Error('用户不存在');

    const ok = await bcrypt.compare(password, user.PasswordHash);
    if (!ok) throw new Error('密码错误');

    const token = jwt.sign({ userId: user.UserID, role: user.UserRole }, JWT_SECRET, { expiresIn: '24h' });
    const { PasswordHash, ...safe } = user;
    return res.status(200).json({ success: true, message: '登录成功', data: safe, token });
  } catch (error) {
    return res.status(401).json({ success: false, error: error.message });
  }
});

// 更新个人信息
app.put('/api/me/profile', verifyToken, async (req, res) => {
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

// 获取个人信息
app.get('/api/me/profile', verifyToken, async (req, res) => {
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

// 获取当前用户所有通知（按时间倒序）
app.get('/api/notifications', verifyToken, async (req, res) => {
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

// 标记通知已读
app.post('/api/notifications/:id/read', verifyToken, async (req, res) => {
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

app.get('/api/games', async (req, res) => {
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

app.get('/api/tournaments', async (_req, res) => {
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

app.get('/api/tournaments/:tournamentId', async (req, res) => {
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

app.get('/api/teams', async (_req, res) => {
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

app.get('/api/teams/:teamId', async (req, res) => {
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

// ==========================================
// Protected APIs
// ==========================================
// 招募雷达：按用户名模糊搜索，返回轻量字段
app.get('/api/users/search', verifyToken, async (req, res) => {
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

// 当前用户的队伍看板聚合数据（队伍/成员/报名赛事/赛程/proposal状态）
app.get('/api/me/team-dashboard', verifyToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const userTeams = await prisma.userTeam.findMany({
      where: { UserID: userId },
      include: {
        Team: {
          include: {
            Game: true,
            Members: {
              include: { User: { select: { UserID: true, UserName: true, Rank: true, MainRole: true } } },
              orderBy: { JoinedAt: 'asc' }
            },
            SignUps: {
              include: {
                Tournament: {
                  include: {
                    MatchInfos: {
                      include: {
                        MatchParticipations: { include: { Team: true } },
                        Proposals: { orderBy: { CreatedAt: 'desc' } },
                        ConfirmedProposal: true
                      },
                      orderBy: { MatchTime: 'asc' }
                    }
                  }
                }
              }
            }
          }
        }
      }
    });

    const shaped = userTeams.map((ut) => {
      const team = ut.Team;
      const teamIsCaptain = team.CaptainID === userId;
      const tournaments = (team.SignUps || []).map((signup) => {
        const t = signup.Tournament;
        const matches = (t.MatchInfos || []).map((m) => {
          const participants = (m.MatchParticipations || []).map((p) => p.TeamID);
          const involvesMe = participants.includes(team.TeamID);
          const latestPending = (m.Proposals || []).find((p) => p.Status === 'Pending');

          let pendingAction = null;
          if (involvesMe && latestPending && teamIsCaptain) {
            if (latestPending.InitiatorTeamID === team.TeamID) pendingAction = 'PROPOSED_WAITING';
            if (latestPending.ResponderTeamID === team.TeamID) pendingAction = 'ACCEPT';
          }

          const opponent = (m.MatchParticipations || [])
            .map((p) => p.Team?.TeamName)
            .find((n, idx) => (m.MatchParticipations[idx]?.TeamID !== team.TeamID)) || 'TBD';

          const myRow = (m.MatchParticipations || []).find((p) => p.TeamID === team.TeamID);
          const oppRow = (m.MatchParticipations || []).find((p) => p.TeamID !== team.TeamID);

          return {
            id: m.MatchID,
            round: m.MatchName,
            type: m.MatchType,
            status: m.Status === 'Finished' ? 'FINISHED' : (pendingAction ? 'PENDING' : 'UPCOMING'),
            time: m.MatchTime,
            opponent,
            pendingAction,
            score: myRow && oppRow && myRow.Score !== null && oppRow.Score !== null ? `${myRow.Score} - ${oppRow.Score}` : null,
            result: myRow?.IsWinner === true ? 'WIN' : myRow?.IsWinner === false ? 'LOSE' : null
          };
        });

        const next = matches.find((m) => m.status !== 'FINISHED');
        const isCaptainActionRequired = teamIsCaptain && matches.some((m) => m.pendingAction === 'ACCEPT');

        return {
          id: t.TournamentID,
          name: t.TournamentName,
          status: t.Status || 'REGISTRATION',
          nextMatch: next ? `${next.round} vs ${next.opponent}` : '无待进行比赛',
          isCaptainActionRequired,
          matches
        };
      });

      return {
        ...ut,
        Team: {
          ...team,
          TournamentsView: tournaments
        }
      };
    });

    return res.json({ success: true, data: shaped });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// 查询队伍申请单（用于队长审批列表）
app.get('/api/teams/:teamId/requests', verifyToken, async (req, res) => {
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
        // 队长只需要处理 APPLY 申请
        // - RECOMMEND: 先由被推荐人处理，同意后才转为 APPLY
        // - INVITE: 由被邀请人处理，不需要在这里显示
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

// 单场比赛详情（用于赛果录入页）
app.get('/api/matches/:matchId', verifyToken, async (req, res) => {
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

// 建队主流程（事务）：
// 1) 校验并创建 Team + 队长关联
// 2) 可选快捷报名（并回写 CurrentTeams）
// 3) 可选批量发送邀请
app.post('/api/teams', verifyToken, async (req, res) => {
  const { TeamName, GameName, TargetTournamentID, InitialInvites } = req.body;
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
        data: { TeamName, GameID: game.GameID, CaptainID: captainId }
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

// 玩家申请入队
app.post('/api/teams/:teamId/apply', verifyToken, async (req, res) => {
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

// 队长邀请 / 队员推荐
app.post('/api/teams/:teamId/invite', verifyToken, async (req, res) => {
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

// 队长审批申请：写 TeamRequest 状态 + 处理人字段；APPROVE 时落 UserTeam
app.put('/api/teams/requests/:requestId', verifyToken, async (req, res) => {
  try {
    const { requestId } = req.params;
    const { action } = req.body;
    const userId = req.user.userId;

    const request = await prisma.teamRequest.findUnique({ where: { RequestID: requestId } });
    if (!request) return res.status(404).json({ success: false, error: '请求不存在' });

    const team = await prisma.team.findUnique({ where: { TeamID: request.TeamID } });
    if (!team) return res.status(404).json({ success: false, error: '队伍不存在' });

    // 权限判断：
    // - APPLY: 需要队长审批
    // - RECOMMEND: 需要被推荐人(TargetUser)先同意/拒绝
    // - INVITE: 需要被邀请者(TargetUser)接受/拒绝
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

      // 不同类型不同处理逻辑
      if (request.Type === 'APPLY' && action === 'APPROVE') {
        // 直接申请入队：批准后直接加入队伍
        const existingMember = await tx.userTeam.findUnique({
          where: { UserID_TeamID: { UserID: request.TargetUserID, TeamID: request.TeamID } }
        });
        if (!existingMember) {
          await tx.userTeam.create({
            data: { UserID: request.TargetUserID, TeamID: request.TeamID, IsCaptain: false }
          });
        }
      } else if (request.Type === 'RECOMMEND' && action === 'APPROVE') {
        // 队员推荐：被推荐人同意后，自动创建一个 APPLY 申请，交给队长审批
        await tx.teamRequest.create({
          data: {
            TeamID: request.TeamID,
            TargetUserID: request.TargetUserID,
            InitiatorID: request.InitiatorID, // 推荐人还是发起人
            Type: 'APPLY',
            Message: `由 ${request.Initiator?.UserName || '队员'} 推荐，被推荐人已同意申请入队。`
          }
        });
      } else if (request.Type === 'INVITE' && action === 'APPROVE') {
        // 队长邀请：被邀请人同意后直接加入队伍
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

// 获取当前用户作为队长且项目匹配的队伍列表（用于赛事报名选择）
app.get('/api/me/captain-teams/:gameId', verifyToken, async (req, res) => {
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

// 获取当前用户所有待处理的队伍通知（申请/邀请/推荐）
app.get('/api/me/notifications/requests', verifyToken, async (req, res) => {
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

// 获取当前用户所有待处理的比赛提议通知
app.get('/api/me/notifications/proposals', verifyToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    // 查询当前用户是队长的所有队伍
    const userTeams = await prisma.userTeam.findMany({
      where: { UserID: userId, IsCaptain: true },
      select: { TeamID: true }
    });

    const teamIds = userTeams.map(ut => ut.TeamID);

    if (teamIds.length === 0) {
      return res.json({ success: true, data: [] });
    }

    // 查询这些队伍参与的比赛中状态为 Pending 的提议
    const proposals = await prisma.matchProposal.findMany({
      where: {
        Status: 'Pending',
        MatchInfo: {
          MatchParticipations: {
            some: { TeamID: { in: teamIds } }
          }
        }
      },
      include: {
        MatchInfo: {
          include: {
            Tournament: { select: { TournamentID: true, TournamentName: true } },
            MatchParticipations: { include: { Team: { select: { TeamName: true } } } }
          }
        }
      },
      orderBy: { CreatedAt: 'desc' }
    });

    const shaped = proposals.map(p => {
      const match = p.MatchInfo;
      // 找到当前用户的队伍和对手队伍
      const myParticipation = match.MatchParticipations.find(mp => teamIds.includes(mp.TeamID));
      const oppParticipation = match.MatchParticipations.find(mp => !teamIds.includes(mp.TeamID));

      // 解析 JSON 数组，取出第一个提议时间
      let firstTime = null;
      try {
        if (!p.ProposedTimes) {
          firstTime = null;
        } else {
          const times = JSON.parse(p.ProposedTimes);
          firstTime = times[0];
        }
      } catch(e) {
        firstTime = null;
      }

      return {
        proposalId: p.ProposalID,
        matchId: match.MatchID,
        tournamentId: match.Tournament.TournamentID,
        tournamentName: match.Tournament.TournamentName,
        roundName: match.MatchName,
        myTeam: myParticipation?.Team?.TeamName || 'Unknown',
        opponentTeam: oppParticipation?.Team?.TeamName || 'Unknown',
        proposedTime: firstTime,
        isInitiator: p.InitiatorTeamID === (myParticipation?.TeamID || ''),
        createdAt: p.CreatedAt
      };
    });

    return res.json({ success: true, data: shaped });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// 普通队员主动退队（队长不可走此流程）
app.delete('/api/teams/:teamId/leave', verifyToken, async (req, res) => {
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

// 队长踢人
app.delete('/api/teams/:teamId/members/:targetId', verifyToken, async (req, res) => {
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

// 解散队伍（软删除）：
// 标记 DisbandedAt，并清理该队报名，逐赛事回写 CurrentTeams
app.delete('/api/teams/:teamId', verifyToken, async (req, res) => {
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

// 赛事报名（仅队长）：报名成功后必须回写 CurrentTeams
app.post('/api/tournaments/:tournamentId/signup', verifyToken, async (req, res) => {
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

// 取消报名（队长或管理员）：删除 SignUp 后回写 CurrentTeams
app.delete('/api/tournaments/:tournamentId/signup/:teamId', verifyToken, async (req, res) => {
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

      // 如果是管理员踢人，记录日志
      if (req.user.role === 'administrator') {
        await tx.adminLog.create({
          data: {
            AdminID: userId,
            ActionType: 'ADMIN_KICK_TEAM_FROM_TOURNAMENT',
            Module: 'Tournament',
            TargetID: tournamentId,
            Details: `Admin kicked team ${team.TeamName} (${teamId}) from tournament ${tournament.TournamentName}`
          }
        });
      }

      return { tournamentId, teamId, currentTeams };
    });
    return res.json({ success: true, message: '已取消报名', data: result });
  } catch (error) {
    return res.status(400).json({ success: false, error: error.message });
  }
});

// 获取赛事参赛名单（用于编辑页面）
app.get('/api/tournaments/:tournamentId/roster', verifyToken, async (req, res) => {
  try {
    const { tournamentId } = req.params;
    // 获取所有报名的队伍
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

// 管理员搜索可添加的队伍（同一项目下，未报名该赛事的队伍）
app.get('/api/admin/tournaments/:tournamentId/search-teams', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { tournamentId } = req.params;
    const { query } = req.query;
    const trimmedQuery = (query || '').trim();

    // 获取赛事信息
    const tournament = await prisma.tournament.findUnique({
      where: { TournamentID: tournamentId },
      select: { GameID: true }
    });
    if (!tournament) {
      return res.status(404).json({ success: false, error: '赛事不存在' });
    }

    // 获取已报名的队伍ID
    const signedUp = await prisma.signUp.findMany({
      where: { TournamentID: tournamentId },
      select: { TeamID: true }
    });
    const signedUpIds = signedUp.map(s => s.TeamID);

    // 搜索队伍：同一项目，不包含已报名，名称包含关键词
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

// 管理员直接添加队伍到赛事
app.post('/api/admin/tournaments/:tournamentId/add-team', verifyToken, requireAdmin, async (req, res) => {
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

    // 检查是否已经报名
    const existing = await prisma.signUp.findUnique({
      where: { TournamentID_TeamID: { TournamentID: tournamentId, TeamID: teamId } }
    });
    if (existing) {
      return res.status(400).json({ success: false, error: '该队伍已报名' });
    }

    // 检查是否达到最大队伍数
    if (tournament.CurrentTeams >= tournament.MaxTeamSize) {
      return res.status(400).json({ success: false, error: '赛事已达到最大队伍数' });
    }

    // 添加报名
    const result = await prisma.$transaction(async (tx) => {
      await tx.signUp.create({
        data: { TournamentID: tournamentId, TeamID: teamId }
      });
      const currentTeams = await recalcTournamentCurrentTeams(tx, tournamentId);
      return { currentTeams };
    });

    // 记录管理员日志
    await prisma.adminLog.create({
      data: {
        AdminID: req.user.userId,
        ActionType: 'ADMIN_ADD_TEAM_TO_TOURNAMENT',
        Module: 'Tournament',
        TargetID: tournamentId,
        Details: `Admin added team ${team.TeamName} (${teamId}) to tournament ${tournament.TournamentName}`
      }
    });

    return res.json({ success: true, message: '添加成功', data: result });
  } catch (error) {
    return res.status(400).json({ success: false, error: error.message });
  }
});

// 发起约赛提案：ProposedTimes 用 JSON 字符串存储
app.post('/api/matches/:matchId/proposals', verifyToken, async (req, res) => {
  try {
    const { matchId } = req.params;
    const { initiatorTeamId, responderTeamId, proposedTimes, message } = req.body;
    if (!initiatorTeamId || !responderTeamId || !Array.isArray(proposedTimes) || proposedTimes.length === 0) {
      return res.status(400).json({ success: false, error: 'initiatorTeamId/responderTeamId/proposedTimes 必填' });
    }

    const actorId = req.user.userId;
    const initiator = await prisma.team.findUnique({ where: { TeamID: initiatorTeamId } });
    if (!initiator || initiator.CaptainID !== actorId) {
      return res.status(403).json({ success: false, error: '仅发起方队长可发起约赛' });
    }

    const proposal = await prisma.matchProposal.create({
      data: {
        MatchID: matchId,
        InitiatorTeamID: initiatorTeamId,
        ResponderTeamID: responderTeamId,
        ProposedTimes: JSON.stringify(proposedTimes),
        Message: message || null
      }
    });

    // 给双方队长创建通知
    const initiatorTeam = await prisma.team.findUnique({ where: { TeamID: initiatorTeamId }, select: { CaptainID: true, TeamName: true } });
    const responderTeam = await prisma.team.findUnique({ where: { TeamID: responderTeamId }, select: { CaptainID: true, TeamName: true } });
    const match = await prisma.matchInfo.findUnique({ where: { MatchID: matchId }, select: { MatchName: true } });

    // 发起方：已发送，等待回复 → 自己发的，直接标记已读，不需要红点
    await prisma.notification.create({
      data: {
        UserID: initiatorTeam.CaptainID,
        TeamID: initiatorTeamId,
        MatchID: matchId,
        Type: 'PROPOSAL_SENT',
        Title: '等待对手回应',
        Description: `你已向 ${responderTeam.TeamName} 发起约赛 · ${match.MatchName}`,
        IsRead: true
      }
    });

    // 接收方：收到新约赛，等待回应 → 标记未读，红点提示
    await prisma.notification.create({
      data: {
        UserID: responderTeam.CaptainID,
        TeamID: responderTeamId,
        MatchID: matchId,
        Type: 'PROPOSAL_RECEIVED',
        Title: '新约赛邀请',
        Description: `${initiatorTeam.TeamName} 向你的队伍发起约赛 · ${match.MatchName}`,
        IsRead: false
      }
    });

    return res.status(201).json({ success: true, data: proposal });
  } catch (error) {
    return res.status(400).json({ success: false, error: error.message });
  }
});

// 查询某场比赛全部约赛提案
app.get('/api/matches/:matchId/proposals', verifyToken, async (req, res) => {
  try {
    const { matchId } = req.params;
    const rows = await prisma.matchProposal.findMany({
      where: { MatchID: matchId },
      orderBy: { CreatedAt: 'desc' }
    });
    return res.json({ success: true, data: rows });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// 响应提案：ACCEPT 时把 proposal 绑定到 MatchInfo，并把选定时间写入 MatchTime
app.put('/api/match-proposals/:proposalId/respond', verifyToken, async (req, res) => {
  try {
    const { proposalId } = req.params;
    const { action, selectedTime } = req.body;
    if (!['ACCEPT', 'REJECT'].includes(action)) {
      return res.status(400).json({ success: false, error: 'action 仅支持 ACCEPT 或 REJECT' });
    }

    const actorId = req.user.userId;
    const proposal = await prisma.matchProposal.findUnique({ where: { ProposalID: proposalId } });
    if (!proposal) return res.status(404).json({ success: false, error: 'proposal 不存在' });

    const responderTeam = await prisma.team.findUnique({ where: { TeamID: proposal.ResponderTeamID } });
    if (!responderTeam || responderTeam.CaptainID !== actorId) {
      return res.status(403).json({ success: false, error: '仅接收方队长可响应约赛' });
    }

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.matchProposal.update({
        where: { ProposalID: proposalId },
        data: {
          Status: action === 'ACCEPT' ? 'Accepted' : 'Rejected',
          ResponderActionAt: new Date()
        }
      });

      if (action === 'ACCEPT') {
        if (!selectedTime) throw new Error('接受提案时必须提供 selectedTime');
        const selectedAt = new Date(selectedTime);
        if (Number.isNaN(selectedAt.getTime())) throw new Error('selectedTime 格式非法');

        await tx.matchInfo.update({
          where: { MatchID: proposal.MatchID },
          data: {
            ConfirmedProposalID: proposal.ProposalID,
            MatchTime: selectedAt,
            Status: 'Scheduled'
          }
        });
      }

      // 如果拒绝了，给发起方队长发通知
      if (action === 'REJECT') {
        const initiatorTeam = await tx.team.findUnique({ where: { TeamID: proposal.InitiatorTeamID }, select: { CaptainID: true, TeamName: true } });
        const match = await tx.matchInfo.findUnique({ where: { MatchID: proposal.MatchID }, select: { MatchName: true } });
        await tx.notification.create({
          data: {
            UserID: initiatorTeam.CaptainID,
            TeamID: proposal.InitiatorTeamID,
            MatchID: proposal.MatchID,
            Type: 'PROPOSAL_REJECTED',
            Title: '对方拒绝了约赛',
            Description: `${initiatorTeam.TeamName} · ${match.MatchName} - 对方拒绝了所有时间提议，请重新发起`,
            IsRead: false
          }
        });
      }

      return updated;
    });

    return res.json({ success: true, data: result });
  } catch (error) {
    return res.status(400).json({ success: false, error: error.message });
  }
});

// ==========================================
// Admin APIs
// ==========================================
// 创建项目（支持可选 gameType）
app.post('/api/games', verifyToken, requireAdmin, async (req, res) => {
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

// 启用/停用项目（软开关）
app.put('/api/games/:gameId/deactivate', verifyToken, requireAdmin, async (req, res) => {
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

// 彻底删除项目（危险操作）：必须没有关联的队伍或赛事才能删除
app.delete('/api/games/:gameId', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { gameId } = req.params;

    // 检查是否有关联的赛事
    const tournamentCount = await prisma.tournament.count({
      where: { GameID: gameId }
    });
    if (tournamentCount > 0) {
      return res.status(400).json({
        success: false,
        error: `无法删除：该项目下仍有 ${tournamentCount} 个赛事，请先删除所有赛事`
      });
    }

    // 检查是否有关联的队伍
    const teamCount = await prisma.team.count({
      where: { GameID: gameId }
    });
    if (teamCount > 0) {
      return res.status(400).json({
        success: false,
        error: `无法删除：该项目下仍有 ${teamCount} 支队伍，请先解散队伍`
      });
    }

    // 安全删除
    await prisma.game.delete({ where: { GameID: gameId } });
    return res.json({ success: true, message: '项目已彻底删除' });
  } catch (error) {
    return res.status(400).json({ success: false, error: error.message });
  }
});

// 创建赛事（事务）：落 Tournament 并写 AdminLog
app.post('/api/tournaments', verifyToken, requireAdmin, async (req, res) => {
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
        module: 'TOURNAMENT',
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

// 修改赛事参数并记录日志
app.put('/api/tournaments/:tournamentId', verifyToken, requireAdmin, async (req, res) => {
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
        module: 'TOURNAMENT',
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

// 创建比赛：先建 MatchInfo，再批量写参赛队 MatchParticipation
app.post('/api/tournaments/:tournamentId/matches', verifyToken, requireAdmin, async (req, res) => {
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

        // 给每个参赛队伍的队长创建"等待约赛"通知
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
        module: 'MATCH',
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

// 获取赛事下的所有比赛
app.get('/api/tournaments/:tournamentId/matches', verifyToken, async (req, res) => {
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

// 编辑比赛基础信息并记录日志
app.put('/api/matches/:matchId', verifyToken, requireAdmin, async (req, res) => {
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
        module: 'MATCH',
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

// 删除比赛并记录日志
app.delete('/api/matches/:matchId', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { matchId } = req.params;
    const operatorId = req.user.userId;
    await prisma.$transaction(async (tx) => {
      await tx.matchInfo.delete({ where: { MatchID: matchId } });
      await writeAdminLog(tx, {
        adminId: operatorId,
        module: 'MATCH',
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

// 录入赛果（事务）：
// upsert 每支队伍成绩 -> 更新比赛状态为 Finished -> 记录 LOCK_RESULT 日志
app.post('/api/matches/:matchId/results', verifyToken, requireAdmin, async (req, res) => {
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
        module: 'MATCH',
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

// 已完赛的 H2H 比赛（首页 Recent Results 用）
app.get('/api/matches/recent', async (_req, res) => {
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
    const data = matches.map(m => {
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

// 尚未完赛、有比赛时间的比赛（首页 Upcoming Matches 用）
app.get('/api/matches/upcoming', async (_req, res) => {
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
    const data = matches.map(m => {
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

// 历史战绩（History 页用，含所有已完赛比赛）
app.get('/api/matches/history', async (req, res) => {
  try {
    const game = req.query.game; // 可选：按游戏名过滤
    const matches = await prisma.matchInfo.findMany({
      where: {
        Status: 'Finished',
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
    const data = matches.map(m => {
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

// 管理员概览统计（用户总数、队伍数、赛事数、待处理比赛数）
app.get('/api/admin/stats', verifyToken, requireAdmin, async (_req, res) => {
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

// 管理员日志查询
app.get('/api/admin/logs', verifyToken, requireAdmin, async (req, res) => {
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

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
});