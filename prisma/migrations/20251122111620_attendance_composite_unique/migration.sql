-- DropIndex
DROP INDEX "public"."Attendance_studentId_status_idx";

-- CreateIndex
CREATE INDEX "Attendance_studentId_idx" ON "Attendance"("studentId");
