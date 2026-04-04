import { z } from "zod";

export const createShiftSchema = z.object({
  scheduleId: z.string().uuid(),
  title: z.string().min(1),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  location: z.string().optional(),
  role: z.string().optional(),
  requiredHeadcount: z.number().int().positive().optional(),
  notes: z.string().optional(),
  employeeId: z.string().uuid().optional(),
});

export const updateShiftSchema = createShiftSchema
  .omit({ scheduleId: true })
  .partial();

export const assignEmployeesSchema = z.object({
  employeeIds: z.array(z.string().uuid()).min(1),
});

export type CreateShiftInput = z.infer<typeof createShiftSchema>;
export type UpdateShiftInput = z.infer<typeof updateShiftSchema>;
export type AssignEmployeesInput = z.infer<typeof assignEmployeesSchema>;
