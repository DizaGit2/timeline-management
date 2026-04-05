-- DropForeignKey
ALTER TABLE "swap_requests" DROP CONSTRAINT IF EXISTS "swap_requests_resolvedBy_fkey";

-- DropForeignKey
ALTER TABLE "swap_requests" DROP CONSTRAINT IF EXISTS "swap_requests_targetShiftId_fkey";

-- DropForeignKey
ALTER TABLE "swap_requests" DROP CONSTRAINT IF EXISTS "swap_requests_targetEmployeeId_fkey";

-- DropForeignKey
ALTER TABLE "swap_requests" DROP CONSTRAINT IF EXISTS "swap_requests_requestingShiftId_fkey";

-- DropForeignKey
ALTER TABLE "swap_requests" DROP CONSTRAINT IF EXISTS "swap_requests_requestingEmployeeId_fkey";

-- DropForeignKey
ALTER TABLE "swap_requests" DROP CONSTRAINT IF EXISTS "swap_requests_scheduleId_fkey";

-- DropTable
DROP TABLE IF EXISTS "swap_requests";

-- DropEnum
DROP TYPE IF EXISTS "SwapRequestStatus";
