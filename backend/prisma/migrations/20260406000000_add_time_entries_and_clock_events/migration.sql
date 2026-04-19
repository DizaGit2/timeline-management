-- CreateEnum
CREATE TYPE "TimeEntryType" AS ENUM ('CLOCK_IN', 'CLOCK_OUT');

-- CreateEnum
CREATE TYPE "ClockEventStatus" AS ENUM ('PENDING', 'PROCESSED', 'DUPLICATE', 'ERROR');

-- CreateTable
CREATE TABLE "time_entries" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "type" "TimeEntryType" NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "shift_id" TEXT,
    "notes" TEXT,
    "source" TEXT NOT NULL DEFAULT 'web',
    "idempotency_key" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "time_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clock_events" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "type" "TimeEntryType" NOT NULL,
    "client_timestamp" TIMESTAMP(3) NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "status" "ClockEventStatus" NOT NULL DEFAULT 'PENDING',
    "error_message" TEXT,
    "time_entry_id" TEXT,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),

    CONSTRAINT "clock_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "time_entries_idempotency_key_key" ON "time_entries"("idempotency_key");

-- CreateIndex
CREATE INDEX "time_entries_employee_id_idx" ON "time_entries"("employee_id");

-- CreateIndex
CREATE INDEX "time_entries_organization_id_idx" ON "time_entries"("organization_id");

-- CreateIndex
CREATE INDEX "time_entries_timestamp_idx" ON "time_entries"("timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "clock_events_idempotency_key_key" ON "clock_events"("idempotency_key");

-- CreateIndex
CREATE INDEX "clock_events_employee_id_idx" ON "clock_events"("employee_id");

-- CreateIndex
CREATE INDEX "clock_events_organization_id_idx" ON "clock_events"("organization_id");

-- CreateIndex
CREATE INDEX "clock_events_status_idx" ON "clock_events"("status");

-- AddForeignKey
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clock_events" ADD CONSTRAINT "clock_events_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clock_events" ADD CONSTRAINT "clock_events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
