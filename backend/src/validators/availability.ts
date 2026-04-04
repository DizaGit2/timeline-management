import { z } from "zod";

export const availabilityWindowSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Must be HH:MM format"),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "Must be HH:MM format"),
  type: z.enum(["AVAILABLE", "UNAVAILABLE", "PREFERRED"]).optional(),
});

export const replaceAvailabilitySchema = z.array(availabilityWindowSchema).min(0);

export const createUnavailabilitySchema = z.object({
  date: z.string().datetime(),
  reason: z.string().optional(),
});

export type AvailabilityWindowInput = z.infer<typeof availabilityWindowSchema>;
export type CreateUnavailabilityInput = z.infer<typeof createUnavailabilitySchema>;
