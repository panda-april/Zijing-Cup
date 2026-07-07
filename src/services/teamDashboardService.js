async function getDashboard(prisma, userId) {
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

  return shaped;
}

module.exports = { getDashboard };
