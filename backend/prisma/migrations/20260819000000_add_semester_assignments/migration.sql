ALTER TABLE "payments" ADD COLUMN "semester" TEXT;
ALTER TABLE "teams" ADD COLUMN "semester" TEXT;
ALTER TABLE "events" ADD COLUMN "semester" TEXT;

UPDATE "payments"
SET "semester" = CASE
  WHEN EXTRACT(MONTH FROM "createdAt") BETWEEN 1 AND 5
    THEN 'SPRING_' || EXTRACT(YEAR FROM "createdAt")::int
  ELSE 'FALL_' || EXTRACT(YEAR FROM "createdAt")::int
END;

UPDATE "teams"
SET "semester" = CASE
  WHEN EXTRACT(MONTH FROM "createdAt") BETWEEN 1 AND 5
    THEN 'SPRING_' || EXTRACT(YEAR FROM "createdAt")::int
  ELSE 'FALL_' || EXTRACT(YEAR FROM "createdAt")::int
END;

UPDATE "events"
SET "semester" = CASE
  WHEN EXTRACT(MONTH FROM "startTime") BETWEEN 1 AND 5
    THEN 'SPRING_' || EXTRACT(YEAR FROM "startTime")::int
  ELSE 'FALL_' || EXTRACT(YEAR FROM "startTime")::int
END;

ALTER TABLE "payments" ALTER COLUMN "semester" SET NOT NULL;
ALTER TABLE "teams" ALTER COLUMN "semester" SET NOT NULL;
ALTER TABLE "events" ALTER COLUMN "semester" SET NOT NULL;

CREATE INDEX "payments_semester_idx" ON "payments"("semester");
CREATE INDEX "teams_semester_idx" ON "teams"("semester");
CREATE INDEX "events_semester_idx" ON "events"("semester");
