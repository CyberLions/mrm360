UPDATE "payments"
SET "expiresAt" = make_timestamptz(
  split_part("semester", '_', 2)::int + 1,
  8,
  1,
  0,
  0,
  0,
  'UTC'
)
WHERE "paymentType" = 'YEARLY'
  AND "semester" LIKE 'FALL\_%' ESCAPE '\';
