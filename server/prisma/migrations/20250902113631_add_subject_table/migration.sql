/*
  Warnings:

  - You are about to drop the column `subject` on the `StudyDetail` table. All the data in the column will be lost.
  - Added the required column `subjectId` to the `StudyDetail` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "Subject" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Subject_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_StudyDetail" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "studyDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "color" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "durationMin" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "questionsRight" INTEGER NOT NULL,
    "questionsWrong" INTEGER NOT NULL,
    "pageStart" INTEGER,
    "pageEnd" INTEGER,
    "comment" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StudyDetail_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "StudyDetail_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_StudyDetail" ("category", "color", "comment", "content", "createdAt", "durationMin", "id", "pageEnd", "pageStart", "questionsRight", "questionsWrong", "studyDate", "userId") SELECT "category", "color", "comment", "content", "createdAt", "durationMin", "id", "pageEnd", "pageStart", "questionsRight", "questionsWrong", "studyDate", "userId" FROM "StudyDetail";
DROP TABLE "StudyDetail";
ALTER TABLE "new_StudyDetail" RENAME TO "StudyDetail";
CREATE INDEX "StudyDetail_userId_studyDate_idx" ON "StudyDetail"("userId", "studyDate");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Subject_userId_name_key" ON "Subject"("userId", "name");
