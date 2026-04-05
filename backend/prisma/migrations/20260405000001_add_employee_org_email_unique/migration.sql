-- CreateIndex
CREATE UNIQUE INDEX "employees_organization_id_email_key" ON "employees"("organization_id", "email");
