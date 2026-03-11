/*
  Warnings:

  - Added the required column `PasswordHash` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "UserID" TEXT NOT NULL PRIMARY KEY,
    "UserName" TEXT NOT NULL,
    "UserRole" TEXT NOT NULL DEFAULT 'audience',
    "PasswordHash" TEXT NOT NULL
);
INSERT INTO "new_User" ("UserID", "UserName", "UserRole") SELECT "UserID", "UserName", "UserRole" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_UserName_key" ON "User"("UserName");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
