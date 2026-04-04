-- CreateTable
CREATE TABLE "shift_assignments" (
    "id" TEXT NOT NULL,
    "shift_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shift_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "shift_assignments_shift_id_idx" ON "shift_assignments"("shift_id");

-- CreateIndex
CREATE INDEX "shift_assignments_employee_id_idx" ON "shift_assignments"("employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "shift_assignments_shift_id_employee_id_key" ON "shift_assignments"("shift_id", "employee_id");

-- AddForeignKey
ALTER TABLE "shift_assignments" ADD CONSTRAINT "shift_assignments_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "shifts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_assignments" ADD CONSTRAINT "shift_assignments_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
