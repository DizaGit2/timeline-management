import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import jwt, { SignOptions } from "jsonwebtoken";
import prisma from "../lib/prisma";
import { config } from "../config";
import { AppError } from "../middleware/errorHandler";
import {
  RegisterInput,
  LoginInput,
  RefreshInput,
  ForgotPasswordInput,
  ResetPasswordInput,
} from "../validators/auth";
import { JwtPayload } from "../middleware/authGuard";

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function generateTokens(payload: JwtPayload) {
  const accessOpts: SignOptions = { algorithm: "HS256", expiresIn: config.jwt.expiresIn as SignOptions["expiresIn"] };
  const refreshOpts: SignOptions = { algorithm: "HS256", expiresIn: config.jwt.refreshExpiresIn as SignOptions["expiresIn"] };
  const accessToken = jwt.sign(payload, config.jwt.secret, accessOpts);
  const refreshToken = jwt.sign(payload, config.jwt.refreshSecret, refreshOpts);
  return { accessToken, refreshToken };
}

const REFRESH_TOKEN_EXPIRES_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export async function register(req: Request, res: Response): Promise<void> {
  const { email, password, name, organizationName } = req.body as RegisterInput;

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    throw new AppError(409, "Email already registered");
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email,
        passwordHash,
        name,
        role: "ADMIN",
        isActive: true,
        organization: {
          create: {
            name: organizationName,
            ownerUserId: "", // placeholder, updated below
          },
        },
      },
      include: { organization: true },
    });

    await tx.organization.update({
      where: { id: user.organizationId },
      data: { ownerUserId: user.id },
    });

    return user;
  });

  const payload: JwtPayload = {
    userId: result.id,
    organizationId: result.organizationId,
    role: result.role,
  };

  const tokens = generateTokens(payload);

  await prisma.refreshToken.create({
    data: {
      userId: result.id,
      tokenHash: hashToken(tokens.refreshToken),
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRES_MS),
    },
  });

  res.status(201).json({
    user: { id: result.id, email: result.email, name: result.name, role: result.role },
    organization: { id: result.organization.id, name: result.organization.name },
    ...tokens,
  });
}

export async function login(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body as LoginInput;

  const user = await prisma.user.findUnique({
    where: { email },
    include: { organization: true },
  });

  if (!user || !user.isActive) {
    throw new AppError(401, "Invalid credentials");
  }

  const validPassword = await bcrypt.compare(password, user.passwordHash);
  if (!validPassword) {
    throw new AppError(401, "Invalid credentials");
  }

  const payload: JwtPayload = {
    userId: user.id,
    organizationId: user.organizationId,
    role: user.role,
  };

  const tokens = generateTokens(payload);

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(tokens.refreshToken),
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRES_MS),
    },
  });

  res.json({
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
    ...tokens,
  });
}

export async function refresh(req: Request, res: Response): Promise<void> {
  const { refreshToken } = req.body as RefreshInput;

  let decoded: JwtPayload;
  try {
    decoded = jwt.verify(refreshToken, config.jwt.refreshSecret, { algorithms: ["HS256"] }) as JwtPayload;
  } catch {
    throw new AppError(401, "Invalid refresh token");
  }

  const tokenHash = hashToken(refreshToken);
  const storedToken = await prisma.refreshToken.findUnique({
    where: { tokenHash },
  });

  if (!storedToken || storedToken.revoked || storedToken.expiresAt < new Date()) {
    throw new AppError(401, "Invalid refresh token");
  }

  // Revoke old token (rotation)
  await prisma.refreshToken.update({
    where: { id: storedToken.id },
    data: { revoked: true },
  });

  const payload: JwtPayload = {
    userId: decoded.userId,
    organizationId: decoded.organizationId,
    role: decoded.role,
  };

  const tokens = generateTokens(payload);

  await prisma.refreshToken.create({
    data: {
      userId: decoded.userId,
      tokenHash: hashToken(tokens.refreshToken),
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRES_MS),
    },
  });

  res.json(tokens);
}

export async function logout(req: Request, res: Response): Promise<void> {
  const userId = req.user?.userId;
  if (!userId) {
    throw new AppError(401, "Not authenticated");
  }

  // Revoke all active refresh tokens for this user
  await prisma.refreshToken.updateMany({
    where: { userId, revoked: false },
    data: { revoked: true },
  });

  res.json({ message: "Logged out successfully" });
}

export async function forgotPassword(req: Request, res: Response): Promise<void> {
  const { email } = req.body as ForgotPasswordInput;

  const user = await prisma.user.findUnique({ where: { email } });

  // Always return success to prevent email enumeration
  if (!user) {
    res.json({ message: "If that email is registered, a reset link has been sent" });
    return;
  }

  const resetToken = crypto.randomBytes(32).toString("hex");
  const resetTokenHash = hashToken(resetToken);
  const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await prisma.user.update({
    where: { id: user.id },
    data: {
      resetToken: resetTokenHash,
      resetTokenExpiresAt: expires,
    },
  });

  // TODO: integrate email service to send resetToken to user's email
  // For now, log in development mode
  if (config.nodeEnv === "development") {
    console.log(`[DEV] Password reset token for ${email}: ${resetToken}`);
  }

  res.json({ message: "If that email is registered, a reset link has been sent" });
}

export async function resetPassword(req: Request, res: Response): Promise<void> {
  const { token, newPassword } = req.body as ResetPasswordInput;

  const tokenHash = hashToken(token);

  const user = await prisma.user.findFirst({
    where: {
      resetToken: tokenHash,
      resetTokenExpiresAt: { gt: new Date() },
    },
  });

  if (!user) {
    throw new AppError(400, "Invalid or expired reset token");
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);

  // Update password, clear reset token, and revoke all refresh tokens
  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        resetToken: null,
        resetTokenExpiresAt: null,
      },
    }),
    prisma.refreshToken.updateMany({
      where: { userId: user.id, revoked: false },
      data: { revoked: true },
    }),
  ]);

  res.json({ message: "Password reset successfully" });
}
