-- AlterTable: Add is_active column to employees (default true for existing rows)
ALTER TABLE "employees" ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable: unavailability_exceptions
CREATE TABLE "unavailability_exceptions" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "unavailability_exceptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "unavailability_exceptions_employee_id_idx" ON "unavailability_exceptions"("employee_id");

-- CreateIndex
CREATE INDEX "unavailability_exceptions_date_idx" ON "unavailability_exceptions"("date");

-- AddForeignKey
ALTER TABLE "unavailability_exceptions" ADD CONSTRAINT "unavailability_exceptions_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
