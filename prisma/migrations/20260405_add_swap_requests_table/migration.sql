-- CreateEnum
CREATE TYPE "SwapRequestStatus" AS ENUM ('pending_target', 'pending_manager', 'approved', 'rejected', 'expired', 'cancelled');

-- CreateTable
CREATE TABLE "swap_requests" (
    "id" UUID NOT NULL,
    "scheduleId" UUID NOT NULL,
    "requestingEmployeeId" UUID NOT NULL,
    "requestingShiftId" UUID NOT NULL,
    "targetEmployeeId" UUID,
    "targetShiftId" UUID,
    "status" "SwapRequestStatus" NOT NULL DEFAULT 'pending_target',
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "swap_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "swap_requests_status_scheduleId_idx" ON "swap_requests"("status", "scheduleId");

-- CreateIndex
CREATE INDEX "swap_requests_requestingEmployeeId_idx" ON "swap_requests"("requestingEmployeeId");

-- CreateIndex
CREATE INDEX "swap_requests_targetEmployeeId_idx" ON "swap_requests"("targetEmployeeId");

-- AddForeignKey
ALTER TABLE "swap_requests" ADD CONSTRAINT "swap_requests_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "swap_requests" ADD CONSTRAINT "swap_requests_requestingEmployeeId_fkey" FOREIGN KEY ("requestingEmployeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "swap_requests" ADD CONSTRAINT "swap_requests_requestingShiftId_fkey" FOREIGN KEY ("requestingShiftId") REFERENCES "shifts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "swap_requests" ADD CONSTRAINT "swap_requests_targetEmployeeId_fkey" FOREIGN KEY ("targetEmployeeId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "swap_requests" ADD CONSTRAINT "swap_requests_targetShiftId_fkey" FOREIGN KEY ("targetShiftId") REFERENCES "shifts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "swap_requests" ADD CONSTRAINT "swap_requests_resolvedBy_fkey" FOREIGN KEY ("resolvedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
