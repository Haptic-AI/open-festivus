-- Snapshot the Clerk user's primary email at mint time so we can email
-- the submitter on PATCH submission and review outcomes without adding a
-- Clerk backend-SDK dependency to api/.
ALTER TABLE "api_keys" ADD COLUMN "owner_email" TEXT;
