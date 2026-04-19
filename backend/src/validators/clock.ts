import { z } from "zod";

const clockEventSchema = z.object({
  type: z.enum(["CLOCK_IN", "CLOCK_OUT"]),
  clientTimestamp: z.string().datetime(),
  idempotencyKey: z.string().min(1).max(255),
  shiftId: z.string().uuid().optional(),
  notes: z.string().optional(),
});

export const syncClockEventsSchema = z.object({
  events: z.array(clockEventSchema).min(1).max(100),
});

export const clockInOutSchema = z.object({
  type: z.enum(["CLOCK_IN", "CLOCK_OUT"]),
  timestamp: z.string().datetime().optional(),
  shiftId: z.string().uuid().optional(),
  notes: z.string().optional(),
  idempotencyKey: z.string().min(1).max(255),
});

export type SyncClockEventsInput = z.infer<typeof syncClockEventsSchema>;
export type ClockInOutInput = z.infer<typeof clockInOutSchema>;
