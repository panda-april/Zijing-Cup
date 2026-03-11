-- CreateTable
CREATE TABLE "User" (
    "UserID" TEXT NOT NULL PRIMARY KEY,
    "UserName" TEXT NOT NULL,
    "UserRole" TEXT NOT NULL DEFAULT 'audience'
);

-- CreateTable
CREATE TABLE "Game" (
    "GameID" TEXT NOT NULL PRIMARY KEY,
    "GameName" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Team" (
    "TeamID" TEXT NOT NULL PRIMARY KEY,
    "TeamName" TEXT NOT NULL,
    "GameID" TEXT NOT NULL,
    "CaptainID" TEXT NOT NULL,
    CONSTRAINT "Team_GameID_fkey" FOREIGN KEY ("GameID") REFERENCES "Game" ("GameID") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Team_CaptainID_fkey" FOREIGN KEY ("CaptainID") REFERENCES "User" ("UserID") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserTeam" (
    "UserID" TEXT NOT NULL,
    "TeamID" TEXT NOT NULL,
    "IsCaptain" BOOLEAN NOT NULL DEFAULT false,

    PRIMARY KEY ("UserID", "TeamID"),
    CONSTRAINT "UserTeam_UserID_fkey" FOREIGN KEY ("UserID") REFERENCES "User" ("UserID") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserTeam_TeamID_fkey" FOREIGN KEY ("TeamID") REFERENCES "Team" ("TeamID") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MatchInfo" (
    "MatchID" TEXT NOT NULL PRIMARY KEY,
    "MatchName" TEXT NOT NULL,
    "MaxTeamAmount" INTEGER NOT NULL,
    "TournamentID" TEXT NOT NULL,
    "FinalStartTime" DATETIME,
    "Status" TEXT NOT NULL DEFAULT 'Scheduling',
    CONSTRAINT "MatchInfo_TournamentID_fkey" FOREIGN KEY ("TournamentID") REFERENCES "Tournament" ("TournamentID") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Tournament" (
    "TournamentID" TEXT NOT NULL PRIMARY KEY,
    "TournamentName" TEXT NOT NULL,
    "MaxTeamSize" INTEGER NOT NULL,
    "GameID" TEXT NOT NULL,
    CONSTRAINT "Tournament_GameID_fkey" FOREIGN KEY ("GameID") REFERENCES "Game" ("GameID") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SignUp" (
    "TournamentID" TEXT NOT NULL,
    "TeamID" TEXT NOT NULL,
    "SignUpTime" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("TournamentID", "TeamID"),
    CONSTRAINT "SignUp_TournamentID_fkey" FOREIGN KEY ("TournamentID") REFERENCES "Tournament" ("TournamentID") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SignUp_TeamID_fkey" FOREIGN KEY ("TeamID") REFERENCES "Team" ("TeamID") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MatchProposal" (
    "ProposalID" TEXT NOT NULL PRIMARY KEY,
    "MatchID" TEXT NOT NULL,
    "InitiatorTeamID" TEXT NOT NULL,
    "ResponderTeamID" TEXT NOT NULL,
    "ProposedTimes" TEXT NOT NULL,
    "Status" TEXT NOT NULL DEFAULT 'Pending',
    "CreatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "MatchParticipation" (
    "MatchID" TEXT NOT NULL,
    "TeamID" TEXT NOT NULL,
    "Score" REAL,
    "FinalRank" INTEGER,
    "Status" TEXT NOT NULL DEFAULT 'Registered',

    PRIMARY KEY ("MatchID", "TeamID"),
    CONSTRAINT "MatchParticipation_MatchID_fkey" FOREIGN KEY ("MatchID") REFERENCES "MatchInfo" ("MatchID") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MatchParticipation_TeamID_fkey" FOREIGN KEY ("TeamID") REFERENCES "Team" ("TeamID") ON DELETE CASCADE ON UPDATE CASCADE
);
