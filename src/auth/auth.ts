import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin, haveIBeenPwned, twoFactor } from "better-auth/plugins";
import { passkey } from "@better-auth/passkey";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/db/client";
import { env } from "@/config/env";

export const auth = betterAuth({
  appName: "BlakCert",
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  database: drizzleAdapter(db, { provider: "pg", usePlural: true }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 14,
    maxPasswordLength: 256,
    requireEmailVerification: env.NODE_ENV === "production",
    sendResetPassword: async ({ user, url }) => {
      const { logger } = await import("@/observability/logger");
      logger.info(
        { event: "auth.password_reset.requested", userId: user.id, url },
        "Development email",
      );
    },
  },
  emailVerification: {
    sendVerificationEmail: async ({ user, url }) => {
      const { logger } = await import("@/observability/logger");
      logger.info(
        { event: "auth.email_verification.requested", userId: user.id, url },
        "Development email",
      );
    },
  },
  session: {
    expiresIn: 60 * 60 * 8,
    updateAge: 60 * 30,
    cookieCache: { enabled: true, maxAge: 60 * 5 },
  },
  rateLimit: { enabled: true, window: 60, max: 30 },
  advanced: {
    database: { generateId: "uuid" },
    cookies: {
      session_token: {
        attributes: { httpOnly: true, secure: env.NODE_ENV === "production", sameSite: "lax" },
      },
    },
  },
  plugins: [
    twoFactor({ issuer: "BlakCert", otpOptions: { period: 30, digits: 6 } }),
    passkey({ rpName: "BlakCert", origin: env.BETTER_AUTH_URL }),
    haveIBeenPwned({
      customPasswordCompromisedMessage: "Choose a password not found in known breaches.",
    }),
    admin(),
    nextCookies(),
  ],
});

export type Auth = typeof auth;
