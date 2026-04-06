import { z } from "zod";

export const createSwapRequestSchema = z.object({
  scheduleId: z.string().uuid(),
  requestingShiftId: z.string().uuid(),
  targetEmployeeId: z.string().uuid(),
  targetShiftId: z.string().uuid(),
});

export const respondSwapRequestSchema = z.object({
  action: z.enum(["accept", "decline"]),
});

export const resolveSwapRequestSchema = z.object({
  action: z.enum(["approve", "reject"]),
});

export type CreateSwapRequestInput = z.infer<typeof createSwapRequestSchema>;
export type RespondSwapRequestInput = z.infer<typeof respondSwapRequestSchema>;
export type ResolveSwapRequestInput = z.infer<typeof resolveSwapRequestSchema>;
