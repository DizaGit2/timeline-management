-- AlterTable shifts: add title, location, role, requiredHeadcount; make employeeId nullable

ALTER TABLE "shifts"
  ADD COLUMN "title" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "location" TEXT,
  ADD COLUMN "role" TEXT,
  ADD COLUMN "required_headcount" INTEGER NOT NULL DEFAULT 1;

-- Make employeeId nullable and change ON DELETE to SET NULL
ALTER TABLE "shifts" ALTER COLUMN "employee_id" DROP NOT NULL;

ALTER TABLE "shifts" DROP CONSTRAINT IF EXISTS "shifts_employee_id_fkey";

ALTER TABLE "shifts"
  ADD CONSTRAINT "shifts_employee_id_fkey"
  FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable shift_assignments: migrate from id-based PK to composite PK

ALTER TABLE "shift_assignments" DROP CONSTRAINT IF EXISTS "shift_assignments_pkey";
ALTER TABLE "shift_assignments" DROP CONSTRAINT IF EXISTS "shift_assignments_shift_id_employee_id_key";
ALTER TABLE "shift_assignments" DROP COLUMN IF EXISTS "id";

ALTER TABLE "shift_assignments"
  ADD CONSTRAINT "shift_assignments_pkey" PRIMARY KEY ("shift_id", "employee_id");
