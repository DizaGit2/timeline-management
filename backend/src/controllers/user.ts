import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import prisma from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";
import { CreateUserInput } from "../validators/user";

const ROLE_HIERARCHY: Record<string, string[]> = {
  ADMIN: ["MANAGER", "EMPLOYEE"],
  MANAGER: ["EMPLOYEE"],
  EMPLOYEE: [],
};

export async function createUser(req: Request, res: Response): Promise<void> {
  const { email, password, name, role } = req.body as CreateUserInput;
  const currentUser = req.user!;

  const allowedRoles = ROLE_HIERARCHY[currentUser.role] || [];
  if (!allowedRoles.includes(role)) {
    throw new AppError(403, `${currentUser.role} cannot create users with role ${role}`);
  }

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    throw new AppError(409, "Email already registered");
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      name,
      role,
      organizationId: currentUser.organizationId,
      createdByUserId: currentUser.userId,
    },
  });

  res.status(201).json({
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
  });
}

export async function getMe(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { organization: true },
  });

  if (!user) {
    throw new AppError(404, "User not found");
  }

  res.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      organization: { id: user.organization.id, name: user.organization.name },
    },
  });
}
