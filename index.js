const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const JWT_SECRET = 'ZiJingCup_Super_Secret_Key_2026';

const app = express();
app.use(cors()); // 启用 CORS
app.use(express.json());// 允许 Express 解析 JSON

// 初始化 SQLite 适配器
const adapter = new PrismaBetterSqlite3({
  url: "file:./dev.db"
});
const prisma = new PrismaClient({ adapter });

// ==========================================
// 中间件：JWT 身份验证守卫
// ==========================================
const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: '未登录，请提供有效的访问令牌 (Token)' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // 将解密出的 { userId, role } 挂载到 req 上
    next(); 
  } catch (error) {
    return res.status(401).json({ error: '令牌已失效或不合法，请重新登录' });
  }
};


// ==========================================
// 公开接口区 (不需要登录即可访问)
// ==========================================

// 测试接口
app.get('/ping', (req, res) => {
  res.send('紫荆杯后端服务已启动，Pong!');
});

// 注册用户
app.post('/api/users/register', async (req, res) => {
  const { userName, password, role } = req.body;
  try {
    if (!userName || !password) throw new Error('用户名和密码不能为空');
    const existingUser = await prisma.user.findUnique({ where: { UserName: userName } });
    if (existingUser) throw new Error('该用户名已被注册');

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const userRole = role || 'audience'; 

    const newUser = await prisma.user.create({
      data: { UserName: userName, PasswordHash: hashedPassword, UserRole: userRole }
    });

    const { PasswordHash, ...userWithoutPassword } = newUser;
    res.status(201).json({ message: '用户创建成功', data: userWithoutPassword });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// 用户登录
app.post('/api/users/login', async (req, res) => {
  const { userName, password } = req.body;
  try {
    if (!userName || !password) throw new Error('用户名和密码不能为空');

    const user = await prisma.user.findUnique({ where: { UserName: userName } });
    if (!user) throw new Error('用户不存在');

    const isMatch = await bcrypt.compare(password, user.PasswordHash);
    if (!isMatch) throw new Error('密码错误');

    const token = jwt.sign(
      { userId: user.UserID, role: user.UserRole }, 
      JWT_SECRET, 
      { expiresIn: '24h' }
    );

    const { PasswordHash, ...safeUserData } = user;
    res.status(200).json({ message: '登录成功', data: safeUserData, token: token });
  } catch (error) {
    res.status(401).json({ error: error.message });
  }
});

// 1.1 招募雷达：搜索全站活跃玩家
app.get('/api/users/search', verifyToken, async (req, res) => {
  try {
    const { q } = req.query; 
    if (!q) return res.json({ success: true, data: [] });

    const users = await prisma.user.findMany({
      where: {
        UserName: { contains: q }
      },
      select: { UserID: true, UserName: true, Rank: true, MainRole: true },
      take: 10 
    });
    res.json({ success: true, data: users });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 1.2 观众主动申请加入队伍
app.post('/api/teams/:teamId/apply', verifyToken, async (req, res) => {
  try {
    const { teamId } = req.params;
    const { message } = req.body;
    const userId = req.user.userId;

    const existing = await prisma.teamRequest.findFirst({
      where: { TeamID: teamId, TargetUserID: userId, Status: 'PENDING' }
    });
    if (existing) return res.status(400).json({ success: false, error: "你已经发送过申请，请等待队长审核。" });

    const request = await prisma.teamRequest.create({
      data: {
        TeamID: teamId,
        TargetUserID: userId,
        InitiatorID: userId, 
        Type: 'APPLY',
        Message: message || "请求加入队伍！"
      }
    });
    res.json({ success: true, data: request });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});


// ==========================================
// 受保护接口区 (必须携带 Token 才能访问)
// ==========================================

// 1. 修改密码 (仅限自己)
app.put('/api/users/password', verifyToken, async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  const userId = req.user.userId; // 直接从 Token 里取，防止改别人的密码

  try {
    const user = await prisma.user.findUnique({ where: { UserID: userId } });
    const isMatch = await bcrypt.compare(oldPassword, user.PasswordHash);
    if (!isMatch) throw new Error('旧密码不正确');

    const salt = await bcrypt.genSalt(10);
    const hashedNewPassword = await bcrypt.hash(newPassword, salt);

    await prisma.user.update({
      where: { UserID: userId },
      data: { PasswordHash: hashedNewPassword }
    });

    res.status(200).json({ message: '密码修改成功' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// 2. 管理权限 (仅限管理员)
app.put('/api/users/:id/role', verifyToken, async (req, res) => {
  const { id } = req.params; // 被修改人的ID
  const { newRole } = req.body; 
  const operatorId = req.user.userId; // 从 Token 提取操作者

  try {
    if (req.user.role !== 'administrator') throw new Error('权限不足：仅管理员可操作');

    const updatedUser = await prisma.user.update({
      where: { UserID: id },
      data: { UserRole: newRole }
    });

    await prisma.adminLog.create({
      data: {
        AdminID: operatorId, ActionType: 'UPDATE_ROLE', TargetID: id,
        Details: `管理员将用户ID: ${id} 的权限修改为 ${newRole}`
      }
    });

    const { PasswordHash, ...userWithoutPassword } = updatedUser;
    res.status(200).json({ message: '权限修改成功', data: userWithoutPassword });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// 3. 删除用户 (仅限管理员)
app.delete('/api/users/:id', verifyToken, async (req, res) => {
  const { id } = req.params;
  const operatorId = req.user.userId;

  try {
    if (req.user.role !== 'administrator') throw new Error('权限不足：仅管理员可操作');

    await prisma.user.delete({ where: { UserID: id } });

    await prisma.adminLog.create({
      data: {
        AdminID: operatorId, ActionType: 'DELETE_USER', TargetID: id,
        Details: `管理员删除了用户ID: ${id}`
      }
    });

    res.status(200).json({ message: '用户已成功删除' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// 4. 创建比赛项目 (仅限管理员)
app.post('/api/games', verifyToken, async (req, res) => {
  const { gameName } = req.body;
  try {
    if (req.user.role !== 'administrator') throw new Error('权限不足：仅管理员可操作');
    if (!gameName) throw new Error('必须提供比赛项目名称');

    const newGame = await prisma.game.create({ data: { GameName: gameName } });
    res.status(201).json({ message: '比赛项目创建成功', data: newGame });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// 5. 基础功能1: 创建队伍 (仅限管理员)
app.post('/api/teams/create', verifyToken, async (req, res) => {
  // 注意：不再需要接收 operatorId，彻底防篡改
  const { teamName, gameId, captainId } = req.body;
  const operatorId = req.user.userId; 

  try {
    if (req.user.role !== 'administrator') throw new Error('权限不足：仅管理员可操作');

    const result = await prisma.$transaction(async (tx) => {
      const captain = await tx.user.findUnique({ where: { UserID: captainId } });
      if (!captain) throw new Error('指定的队长用户不存在');

      const game = await tx.game.findUnique({ where: { GameID: gameId } });
      if (!game) throw new Error('比赛项目不存在');

      const newTeam = await tx.team.create({
        data: { TeamName: teamName, GameID: gameId, CaptainID: captainId }
      });

      await tx.userTeam.create({
        data: { UserID: captainId, TeamID: newTeam.TeamID, IsCaptain: true }
      });

      if (captain.UserRole !== 'administrator' && captain.UserRole !== 'player') {
        await tx.user.update({
          where: { UserID: captainId },
          data: { UserRole: 'player' }
        });
      }

      await tx.adminLog.create({
        data: {
          AdminID: operatorId, ActionType: 'CREATE_TEAM', TargetID: newTeam.TeamID,
          Details: `管理员创建队伍: ${teamName}, 队长: ${captainId}`
        }
      });

      return newTeam; 
    });

    res.status(200).json({ success: true, message: '队伍创建成功', data: result });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// 2.1 发送邀请 / 队员推荐
app.post('/api/teams/:teamId/invite', verifyToken, async (req, res) => {
  try {
    const { teamId } = req.params;
    const { targetUserId } = req.body;
    const initiatorId = req.user.userId;

    const userTeam = await prisma.userTeam.findUnique({
      where: { UserID_TeamID: { UserID: initiatorId, TeamID: teamId } }
    });
    if (!userTeam) return res.status(403).json({ success: false, error: "你不在该队伍中，无权操作！" });

    const requestType = userTeam.IsCaptain ? 'INVITE' : 'RECOMMEND';

    const request = await prisma.teamRequest.create({
      data: {
        TeamID: teamId,
        TargetUserID: targetUserId,
        InitiatorID: initiatorId,
        Type: requestType,
        Message: userTeam.IsCaptain ? "队长向你发出了直邀！" : "队员向队长推荐了你。"
      }
    });
    res.json({ success: true, data: request });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 2.2 队员主动退出队伍
app.delete('/api/teams/:teamId/leave', verifyToken, async (req, res) => {
  try {
    const { teamId } = req.params;
    const userId = req.user.userId; 

    const userTeam = await prisma.userTeam.findUnique({
      where: { UserID_TeamID: { UserID: userId, TeamID: teamId } }
    });
    
    if (!userTeam) return res.status(400).json({ success: false, error: "你不在该队伍中。" });
    if (userTeam.IsCaptain) return res.status(403).json({ success: false, error: "队长不能直接退出，请转让队长或解散队伍。" });

    await prisma.userTeam.delete({
      where: { UserID_TeamID: { UserID: userId, TeamID: teamId } }
    });
    res.json({ success: true, message: "已成功退出队伍。" });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 3.1 审批表单 (同意/拒绝)
app.put('/api/teams/requests/:requestId', verifyToken, async (req, res) => {
  try {
    const { requestId } = req.params;
    const { action } = req.body; // 'APPROVE' 或 'REJECT'
    const userId = req.user.userId;

    // 1. 查找请求信息
    const request = await prisma.teamRequest.findUnique({ where: { RequestID: requestId } });
    if (!request) return res.status(404).json({ success: false, error: "请求不存在" });

    // 2. 权限校验：操作者必须是该队伍的队长
    const team = await prisma.team.findUnique({ where: { TeamID: request.TeamID } });
    if (team.CaptainID !== userId) return res.status(403).json({ success: false, error: "只有队长可以审批！" });

    if (action === 'REJECT') {
      await prisma.teamRequest.update({
        where: { RequestID: requestId },
        data: { Status: 'REJECTED' }
      });
      return res.json({ success: true, message: "已拒绝该申请" });
    }

    if (action === 'APPROVE') {
      // 开启事务：改写 Request 状态，并往 UserTeam 插入新队员
      await prisma.$transaction([
        prisma.teamRequest.update({
          where: { RequestID: requestId },
          data: { Status: 'APPROVED' }
        }),
        prisma.userTeam.create({
          data: {
            UserID: request.TargetUserID,
            TeamID: request.TeamID,
            IsCaptain: false
          }
        })
      ]);
      return res.json({ success: true, message: "已同意入队！" });
    }

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 3.2 踢出队员
app.delete('/api/teams/:teamId/members/:targetId', verifyToken, async (req, res) => {
  try {
    const { teamId, targetId } = req.params;
    const captainId = req.user.userId;

    const team = await prisma.team.findUnique({ where: { TeamID: teamId } });
    if (team.CaptainID !== captainId) return res.status(403).json({ success: false, error: "无权操作" });
    if (captainId === targetId) return res.status(400).json({ success: false, error: "队长不能踢自己" });

    await prisma.userTeam.delete({
      where: { UserID_TeamID: { UserID: targetId, TeamID: teamId } }
    });
    res.json({ success: true, message: "已将该成员移出队伍" });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 3.3 解散队伍
app.delete('/api/teams/:teamId', verifyToken, async (req, res) => {
  try {
    const { teamId } = req.params;
    const captainId = req.user.userId;

    const team = await prisma.team.findUnique({ where: { TeamID: teamId } });
    if (team.CaptainID !== captainId) return res.status(403).json({ success: false, error: "只有队长能解散队伍" });

    // 因为 Prisma Schema 里设置了 onDelete: Cascade
    // 这里删除队伍，会自动删除所有 UserTeam 关联和相关的 TeamRequest
    await prisma.team.delete({
      where: { TeamID: teamId }
    });
    
    res.json({ success: true, message: "队伍已解散" });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 7. 创建赛事 (仅限管理员操作)
app.post('/api/tournaments', verifyToken, async (req, res) => {
  const { tournamentName, maxTeamSize, gameId } = req.body;
  const operatorId = req.user.userId;

  try {
    if (req.user.role !== 'administrator') throw new Error('权限不足：仅管理员可操作');

    const result = await prisma.$transaction(async (tx) => {
      // 检查游戏项目是否存在
      const game = await tx.game.findUnique({ where: { GameID: gameId } });
      if (!game) throw new Error('关联的比赛项目不存在');

      // 创建赛事
      const newTournament = await tx.tournament.create({
        data: {
          TournamentName: tournamentName,
          MaxTeamSize: maxTeamSize,
          GameID: gameId
        }
      });

      // 记录日志
      await tx.adminLog.create({
        data: {
          AdminID: operatorId,
          ActionType: 'CREATE_TOURNAMENT',
          TargetID: newTournament.TournamentID,
          Details: `管理员创建了赛事: ${tournamentName}, 最大队伍数: ${maxTeamSize}`
        }
      });

      return newTournament;
    });

    res.status(201).json({ success: true, message: '赛事创建成功', data: result });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// 8. 赛事报名 (仅限队长操作)
app.post('/api/tournaments/:tournamentId/signup', verifyToken, async (req, res) => {
  const { tournamentId } = req.params;
  const { teamId } = req.body;
  const operatorId = req.user.userId;

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. 验证操作者是不是这支队伍的队长
      const userTeam = await tx.userTeam.findUnique({
        where: { UserID_TeamID: { UserID: operatorId, TeamID: teamId } }
      });
      if (!userTeam || !userTeam.IsCaptain) {
        throw new Error('权限不足：只有该队队长可以提交报名');
      }

      // 2. 检查赛事是否存在
      const tournament = await tx.tournament.findUnique({ where: { TournamentID: tournamentId } });
      if (!tournament) throw new Error('赛事不存在');

      // 3. 检查是否重复报名
      const existingSignUp = await tx.signUp.findUnique({
        where: { TournamentID_TeamID: { TournamentID: tournamentId, TeamID: teamId } }
      });
      if (existingSignUp) throw new Error('您的队伍已经报名过该赛事了');

      // 4. 插入报名记录
      const newSignUp = await tx.signUp.create({
        data: {
          TournamentID: tournamentId,
          TeamID: teamId
        }
      });

      return newSignUp;
    });

    res.status(200).json({ success: true, message: '报名成功！', data: result });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// 9. 发起约赛 (支持提议多个时间)
app.post('/api/matches/propose', verifyToken, async (req, res) => {
  // 此时 proposedTimes 接收的是一个数组，例如: ["2026-03-10T10:00Z", "2026-03-10T14:00Z"]
  const { tournamentId, challengerTeamId, targetTeamId, proposedTimes } = req.body;
  const operatorId = req.user.userId;

  try {
    if (!Array.isArray(proposedTimes) || proposedTimes.length === 0) {
      throw new Error('必须至少提供一个候选时间');
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. 验证发起者是不是挑战队伍的队长
      const challengerCap = await tx.userTeam.findUnique({
        where: { UserID_TeamID: { UserID: operatorId, TeamID: challengerTeamId } }
      });
      if (!challengerCap || !challengerCap.IsCaptain) throw new Error('权限不足');

      // 2. 创建比赛主记录 (此时 MatchTime 为空)
      const newMatch = await tx.matchInfo.create({
        data: { TournamentID: tournamentId, Status: 'PENDING_CONFIRM' }
      });

      // 3. 将数组转为 JSON 字符串，存入 Proposal 表
      const newProposal = await tx.matchProposal.create({
        data: {
          MatchID: newMatch.MatchID,
          InitiatorTeamID: challengerTeamId,
          ResponderTeamID: targetTeamId,
          ProposedTimes: JSON.stringify(proposedTimes) // 👈 核心：数组转字符串
        }
      });

      // 4. 创建双方参赛记录 (发起方 ACCEPTED，迎战方 PENDING)
      await tx.matchParticipation.create({ data: { MatchID: newMatch.MatchID, TeamID: challengerTeamId, Status: 'ACCEPTED' } });
      await tx.matchParticipation.create({ data: { MatchID: newMatch.MatchID, TeamID: targetTeamId, Status: 'PENDING' } });

      return newProposal;
    });

    res.status(201).json({ success: true, message: '战书已下达，包含多个候选时间！', data: result });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// 10. 处理约赛请求 (接受特定时间，或全部拒绝)
app.put('/api/matches/proposals/:proposalId/respond', verifyToken, async (req, res) => {
  const { proposalId } = req.params;
  const { action, acceptedTime } = req.body; // action: 'ACCEPT' 且必须带 acceptedTime，或 'REJECT'
  const operatorId = req.user.userId;

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. 查找这个提案
      const proposal = await tx.matchProposal.findUnique({ where: { ProposalID: proposalId } });
      if (!proposal || proposal.Status !== 'Pending') throw new Error('提案不存在或已处理');

      // 2. 验证操作者是不是迎战方的队长
      const responderCap = await tx.userTeam.findUnique({
        where: { UserID_TeamID: { UserID: operatorId, TeamID: proposal.ResponderTeamID } }
      });
      if (!responderCap || !responderCap.IsCaptain) throw new Error('权限不足：只有被挑战方队长可处理');

      if (action === 'REJECT') {
        // 拒绝所有时间
        await tx.matchProposal.update({ where: { ProposalID: proposalId }, data: { Status: 'Rejected' } });
        await tx.matchInfo.update({ where: { MatchID: proposal.MatchID }, data: { Status: 'REJECTED' } });
        return { status: 'REJECTED', message: '已残忍拒绝对方的约赛请求' };
      } 
      
      if (action === 'ACCEPT') {
        if (!acceptedTime) throw new Error('接受约赛时，必须指定一个接受的时间 (acceptedTime)');

        // 极其严谨的安全校验：解析 JSON，确保他选的时间确实是我们给出的候选时间之一！
        const availableTimes = JSON.parse(proposal.ProposedTimes);
        if (!availableTimes.includes(acceptedTime)) {
          throw new Error('非法操作：您选择的时间不在对方的候选列表中');
        }

        // 3. 更新提案状态
        await tx.matchProposal.update({ where: { ProposalID: proposalId }, data: { Status: 'Accepted' } });
        
        // 4. 将对方选中的时间写入比赛主表，比赛正式定档！
        await tx.matchInfo.update({
          where: { MatchID: proposal.MatchID },
          data: { MatchTime: new Date(acceptedTime), Status: 'SCHEDULED' } 
        });

        // 5. 更新迎战方的参赛状态
        await tx.matchParticipation.update({
          where: { MatchID_TeamID: { MatchID: proposal.MatchID, TeamID: proposal.ResponderTeamID } },
          data: { Status: 'ACCEPTED' }
        });

        return { status: 'SCHEDULED', message: `定档成功！比赛时间: ${acceptedTime}` };
      }

      throw new Error('无效的 action');
    });

    res.status(200).json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// 11. 录入比赛结果 (仅限管理员/裁判操作)
app.put('/api/matches/:matchId/results', verifyToken, async (req, res) => {
  const { matchId } = req.params;
  // results 期望是一个数组，包含每支队伍的成绩，例如：
  // [{ teamId: "队伍A_ID", score: 3, finalRank: 1 }, { teamId: "队伍B_ID", score: 1, finalRank: 2 }]
  const { results } = req.body; 
  const operatorId = req.user.userId;

  try {
    const transactionResult = await prisma.$transaction(async (tx) => {
      // 1. 权限与状态校验
      if (req.user.role !== 'administrator') throw new Error('权限不足：仅管理员可以录入赛果');
      
      const match = await tx.matchInfo.findUnique({ where: { MatchID: matchId } });
      if (!match || match.Status !== 'SCHEDULED') {
        throw new Error('比赛不存在或未处于可结算状态 (SCHEDULED)');
      }

      // 2. 遍历传入的成绩数组，逐一更新每支队伍的参与记录
      for (const result of results) {
        await tx.matchParticipation.update({
          where: { MatchID_TeamID: { MatchID: matchId, TeamID: result.teamId } },
          data: { 
            Score: result.score, 
            FinalRank: result.finalRank,
            Status: 'FINISHED' // 标记该队伍已完赛
          }
        });
      }

      // 3. 将这场比赛的主状态改为“已完赛”
      await tx.matchInfo.update({
        where: { MatchID: matchId },
        data: { Status: 'COMPLETED' }
      });

      // 4. 留下严谨的管理员操作日志
      await tx.adminLog.create({
        data: {
          AdminID: operatorId, ActionType: 'UPLOAD_RESULT', TargetID: matchId,
          Details: `管理员录入了比赛 ${matchId} 的最终赛果`
        }
      });

      return { matchId, status: 'COMPLETED' };
    });

    res.status(200).json({ success: true, message: '赛果录入成功！', data: transactionResult });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// 12. 获取赛事积分榜 / 队伍排名
app.get('/api/tournaments/:tournamentId/leaderboard', async (req, res) => {
  const { tournamentId } = req.params;

  try {
    // 1. 确认赛事存在
    const tournament = await prisma.tournament.findUnique({ where: { TournamentID: tournamentId } });
    if (!tournament) throw new Error('赛事不存在');

    // 2. 聚合查询：这正是关系型数据库的强项！
    // 我们找出该赛事下所有已经完赛 (COMPLETED) 的比赛的参赛记录
    const participations = await prisma.matchParticipation.findMany({
      where: {
        Match: {
          TournamentID: tournamentId,
          Status: 'COMPLETED' // 只统计已经打完的比赛
        }
      },
      include: {
        Team: { select: { TeamName: true } } // 顺便把队伍名字带出来
      }
    });

    // 3. 用 JS 在内存里进行数据统计 (计算总分)
    const leaderboardMap = {};

    participations.forEach(p => {
      if (!leaderboardMap[p.TeamID]) {
        leaderboardMap[p.TeamID] = {
          teamId: p.TeamID,
          teamName: p.Team.TeamName,
          totalScore: 0,
          matchesPlayed: 0
        };
      }
      // 累加分数和比赛场次
      leaderboardMap[p.TeamID].totalScore += (p.Score || 0);
      leaderboardMap[p.TeamID].matchesPlayed += 1;
    });

    // 4. 将 Map 转为数组，并按总分从高到低排序！
    const leaderboard = Object.values(leaderboardMap).sort((a, b) => b.totalScore - a.totalScore);

    res.status(200).json({ success: true, data: leaderboard });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});


// ==========================================
// 启动服务
// ==========================================
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
});