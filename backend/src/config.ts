import dotenv from "dotenv";

dotenv.config();

const PLACEHOLDER_JWT_SECRETS = new Set([
  "dev-secret",
  "dev-refresh-secret",
  "change-me-to-a-random-secret",
  "change-me-to-a-different-random-secret",
  "secret",
  "changeme",
]);

function validateJwtSecret(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `[STARTUP] ${name} environment variable is not set. ` +
        `Set it to a strong random secret (minimum 32 characters) before starting the server.`
    );
  }
  if (PLACEHOLDER_JWT_SECRETS.has(value)) {
    throw new Error(
      `[STARTUP] ${name} is set to a known placeholder value "${value}". ` +
        `Replace it with a strong random secret before starting the server.`
    );
  }
  if (value.length < 32) {
    throw new Error(
      `[STARTUP] ${name} must be at least 32 characters long (got ${value.length}). ` +
        `Use a cryptographically random secret.`
    );
  }
  return value;
}

const jwtSecret = validateJwtSecret("JWT_SECRET", process.env.JWT_SECRET);
const jwtRefreshSecret = validateJwtSecret(
  "JWT_REFRESH_SECRET",
  process.env.JWT_REFRESH_SECRET
);

export const config = {
  port: parseInt(process.env.PORT || "3000", 10),
  nodeEnv: process.env.NODE_ENV || "development",
  jwt: {
    secret: jwtSecret,
    refreshSecret: jwtRefreshSecret,
    expiresIn: process.env.JWT_EXPIRES_IN || "15m",
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
  },
  cors: {
    origin: process.env.CORS_ORIGIN || "http://localhost:5173",
  },
  email: {
    from: process.env.EMAIL_FROM || "noreply@timeline.local",
    smtp: {
      host: process.env.SMTP_HOST || "localhost",
      port: parseInt(process.env.SMTP_PORT || "587", 10),
      user: process.env.SMTP_USER || "",
      pass: process.env.SMTP_PASS || "",
    },
  },
};
