-- CreateTable
CREATE TABLE "StudyDetail" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "studyDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "color" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "durationMin" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "questionsRight" INTEGER NOT NULL,
    "questionsWrong" INTEGER NOT NULL,
    "pageStart" INTEGER,
    "pageEnd" INTEGER,
    "comment" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StudyDetail_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "StudyDetail_userId_studyDate_idx" ON "StudyDetail"("userId", "studyDate");
