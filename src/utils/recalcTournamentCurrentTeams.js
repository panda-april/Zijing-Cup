// 统一口径：每次报名/退赛后都以 SignUp 实际数量回写 CurrentTeams，保证强一致
const recalcTournamentCurrentTeams = async (tx, tournamentId) => {
  const count = await tx.signUp.count({ where: { TournamentID: tournamentId } });
  await tx.tournament.update({
    where: { TournamentID: tournamentId },
    data: { CurrentTeams: count }
  });
  return count;
};

module.exports = recalcTournamentCurrentTeams;
