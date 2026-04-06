-- CreateEnum
CREATE TYPE "SwapRequestStatus" AS ENUM ('PENDING_TARGET', 'PENDING_MANAGER', 'APPROVED', 'REJECTED', 'EXPIRED', 'CANCELLED');

-- CreateTable
CREATE TABLE "swap_requests" (
    "id" TEXT NOT NULL,
    "schedule_id" TEXT NOT NULL,
    "requesting_employee_id" TEXT NOT NULL,
    "requesting_shift_id" TEXT NOT NULL,
    "target_employee_id" TEXT NOT NULL,
    "target_shift_id" TEXT NOT NULL,
    "status" "SwapRequestStatus" NOT NULL DEFAULT 'PENDING_TARGET',
    "resolved_at" TIMESTAMP(3),
    "resolved_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "swap_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "swap_requests_status_schedule_id_idx" ON "swap_requests"("status", "schedule_id");

-- CreateIndex
CREATE INDEX "swap_requests_requesting_employee_id_idx" ON "swap_requests"("requesting_employee_id");

-- CreateIndex
CREATE INDEX "swap_requests_target_employee_id_idx" ON "swap_requests"("target_employee_id");

-- AddForeignKey
ALTER TABLE "swap_requests" ADD CONSTRAINT "swap_requests_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "swap_requests" ADD CONSTRAINT "swap_requests_requesting_employee_id_fkey" FOREIGN KEY ("requesting_employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "swap_requests" ADD CONSTRAINT "swap_requests_requesting_shift_id_fkey" FOREIGN KEY ("requesting_shift_id") REFERENCES "shifts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "swap_requests" ADD CONSTRAINT "swap_requests_target_employee_id_fkey" FOREIGN KEY ("target_employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "swap_requests" ADD CONSTRAINT "swap_requests_target_shift_id_fkey" FOREIGN KEY ("target_shift_id") REFERENCES "shifts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "swap_requests" ADD CONSTRAINT "swap_requests_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
