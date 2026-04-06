import { z } from "zod";

const scheduleBaseSchema = z.object({
  name: z.string().min(1),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  location: z.string().min(1).optional(),
  teamId: z.string().uuid().optional(),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).optional(),
});

export const createScheduleSchema = scheduleBaseSchema
  .omit({ status: true })
  .refine(
    (data) => new Date(data.endDate) > new Date(data.startDate),
    { message: "endDate must be after startDate", path: ["endDate"] },
  );

export const updateScheduleSchema = scheduleBaseSchema.partial();

export const copyWeekSchema = z.object({
  sourceWeekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD format"),
  targetWeekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD format"),
});

export type CreateScheduleInput = z.infer<typeof createScheduleSchema>;
export type UpdateScheduleInput = z.infer<typeof updateScheduleSchema>;
export type CopyWeekInput = z.infer<typeof copyWeekSchema>;
