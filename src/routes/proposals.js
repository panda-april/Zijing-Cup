const { Router } = require('express');
const { verifyToken } = require('../middleware/auth');
const prisma = require('../db');

const router = Router();

// GET /api/matches/:matchId/proposals
router.get('/matches/:matchId/proposals', verifyToken, async (req, res) => {
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

// POST /api/matches/:matchId/proposals
router.post('/matches/:matchId/proposals', verifyToken, async (req, res) => {
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

    const initiatorTeam = await prisma.team.findUnique({ where: { TeamID: initiatorTeamId }, select: { CaptainID: true, TeamName: true } });
    const responderTeam = await prisma.team.findUnique({ where: { TeamID: responderTeamId }, select: { CaptainID: true, TeamName: true } });
    const match = await prisma.matchInfo.findUnique({ where: { MatchID: matchId }, select: { MatchName: true } });

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

// PUT /api/match-proposals/:proposalId/respond
router.put('/match-proposals/:proposalId/respond', verifyToken, async (req, res) => {
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

        const initiatorTeam = await tx.team.findUnique({ where: { TeamID: proposal.InitiatorTeamID }, select: { CaptainID: true, TeamName: true } });
        const match = await tx.matchInfo.findUnique({ where: { MatchID: proposal.MatchID }, select: { MatchName: true } });
        await tx.notification.create({
          data: {
            UserID: initiatorTeam.CaptainID,
            TeamID: proposal.InitiatorTeamID,
            MatchID: proposal.MatchID,
            Type: 'PROPOSAL_ACCEPTED',
            Title: '约赛时间已确认',
            Description: `${responderTeam.TeamName} · ${match.MatchName} - 对方已确认时间，比赛已安排`,
            IsRead: false
          }
        });
      }

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

module.exports = router;
