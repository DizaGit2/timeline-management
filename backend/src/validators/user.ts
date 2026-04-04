import { z } from "zod";

export const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
  role: z.enum(["MANAGER", "EMPLOYEE"]),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
