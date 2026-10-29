/*
 * ToolsLibrary - A self-hostable, zero-PII tool library and skill-sharing platform built for local communities.
 * Copyright (C) 2026  Chris Sanders
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

"use server";

import { prisma } from "@/lib/db";
import { auth } from "@/auth";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { generateRecoveryCodes, hashRecoveryCode } from "@/lib/crypto";
import { getRequestClientHash, recordFailure, verifySolution } from "@/lib/pow";
import { enforceRateLimit, rateLimitMessage } from "@/lib/rateLimit";

const registerSchema = z.object({
  username: z.string().regex(/^[a-zA-Z0-9_-]{3,24}$/, "Username must be 3-24 characters, alphanumeric, underscore, or hyphen"),
  alias: z.string().min(2, "Alias must be at least 2 characters").max(32, "Alias must be at most 32 characters"),
  password: z.string().min(10, "Password must be at least 10 characters"),
});

const recoverSchema = z.object({
  username: z.string().min(1),
  recoveryCode: z.string().min(1),
  newPassword: z.string().min(10, "Password must be at least 10 characters"),
});

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export async function registerUser(
  prevState: { success?: boolean; error?: string; recoveryCodes?: string[] } | undefined,
  formData: FormData
) {
  // Account-creation spam gate (PHASE_23_RATE_LIMITING).
  const limit = await enforceRateLimit("register");
  if (!limit.ok) {
    return { success: false, error: rateLimitMessage(limit.retryAfterSeconds) };
  }

  // Proof-of-work gate: the browser must have solved a challenge issued for
  // the register surface before any account is created. Missing or malformed
  // fields take the same failure path as a wrong solution.
  const powCounterValue = formData.get("powCounter");
  const powCounter = powCounterValue === null ? Number.NaN : Number(powCounterValue);
  const clientHash = await getRequestClientHash();
  const pow = verifySolution(
    "register",
    formData.get("powChallenge"),
    Number.isInteger(powCounter) ? powCounter : undefined,
    clientHash
  );
  if (!pow.ok) {
    recordFailure("register", clientHash);
    return {
      success: false,
      error:
        pow.reason === "expired" || pow.reason === "replayed"
          ? "Your proof-of-work challenge expired or was already used. Please try again."
          : "Proof-of-work verification failed. Please try again.",
    };
  }

  const rawData = {
    username: formData.get("username"),
    alias: formData.get("alias"),
    password: formData.get("password"),
  };

  const parsed = registerSchema.safeParse(rawData);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message };
  }

  const { username, alias, password } = parsed.data;

  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { username },
  });
  if (existingUser) {
    return { success: false, error: "Username already taken" };
  }

  // Check if this is the first user (becomes ADMIN)
  const userCount = await prisma.user.count();
  const role = userCount === 0 ? "ADMIN" : "USER";

  // Hash password
  const passwordHash = await bcrypt.hash(password, 12);

  // Generate recovery codes
  const recoveryCodes = generateRecoveryCodes(8);
  const recoveryKeyHashes = recoveryCodes.map(hashRecoveryCode);

  // Create user and recovery keys in a transaction
  await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        username,
        alias,
        passwordHash,
        role,
      },
    });

    await tx.recoveryKey.createMany({
      data: recoveryKeyHashes.map((keyHash) => ({
        keyHash,
        userId: user.id,
      })),
    });
  });

  return { success: true, recoveryCodes };
}

export async function recoverAccount(
  prevState: { success?: boolean; error?: string } | undefined,
  formData: FormData
) {
  // Recovery-key brute-force gate (PHASE_23_RATE_LIMITING): without email
  // verification these 8 single-use codes are the only recovery path, so
  // guessing must be rate-limited before the database lookup.
  const limit = await enforceRateLimit("recover");
  if (!limit.ok) {
    return { success: false, error: rateLimitMessage(limit.retryAfterSeconds) };
  }

  const rawData = {
    username: formData.get("username"),
    recoveryCode: formData.get("recoveryCode"),
    newPassword: formData.get("newPassword"),
  };

  const parsed = recoverSchema.safeParse(rawData);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message };
  }

  const { username, recoveryCode, newPassword } = parsed.data;

  const user = await prisma.user.findUnique({
    where: { username },
    include: { recoveryKeys: true },
  });

  if (!user) {
    return { success: false, error: "User not found" };
  }

  const codeHash = hashRecoveryCode(recoveryCode);
  const recoveryKey = user.recoveryKeys.find((k) => k.keyHash === codeHash && !k.usedAt);

  if (!recoveryKey) {
    return { success: false, error: "Invalid or already used recovery code" };
  }

  const newPasswordHash = await bcrypt.hash(newPassword, 12);

  await prisma.$transaction(async (tx) => {
    await tx.recoveryKey.update({
      where: { id: recoveryKey.id },
      data: { usedAt: new Date() },
    });

    await tx.user.update({
      where: { id: user.id },
      data: { passwordHash: newPasswordHash },
    });
  });

  return { success: true };
}

export async function authenticate(
  prevState: { success?: boolean; error?: string } | undefined,
  formData: FormData
) {
  const rawData = {
    username: formData.get("username"),
    password: formData.get("password"),
  };

  const parsed = loginSchema.safeParse(rawData);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message };
  }

  // The actual authentication is handled by NextAuth's credentials sign-in flow
  // This action is just for form validation before calling signIn
  return { success: true };
}

export async function logoutAction() {
  // The actual logout is handled by NextAuth's signOut
  // This is a placeholder for any server-side cleanup if needed
  return { success: true };
}

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(10, "New password must be at least 10 characters"),
});

export async function changePassword(
  prevState: { success?: boolean; error?: string } | undefined,
  formData: FormData
) {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Authentication required" };
  }

  // Current-password verification is a brute-force surface even when
  // authenticated (PHASE_23_RATE_LIMITING).
  const limit = await enforceRateLimit("changePassword");
  if (!limit.ok) {
    return { success: false, error: rateLimitMessage(limit.retryAfterSeconds) };
  }

  const rawData = {
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
  };

  const parsed = changePasswordSchema.safeParse(rawData);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message };
  }

  const { currentPassword, newPassword } = parsed.data;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  });
  if (!user) {
    return { success: false, error: "User not found" };
  }

  const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!isValid) {
    return { success: false, error: "Current password is incorrect" };
  }

  if (await bcrypt.compare(newPassword, user.passwordHash)) {
    return { success: false, error: "New password must be different from the current password" };
  }

  const newPasswordHash = await bcrypt.hash(newPassword, 12);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: newPasswordHash,
      mustChangePassword: false,
    },
  });

  return { success: true };
}

const deleteOwnAccountSchema = z.object({
  password: z.string().min(1, "Current password is required"),
  acknowledge: z.string().optional(), // "true" when the confirmation box is checked
});

/**
 * Self-service account deletion — the zero-PII exit path. Requires the current
 * password (identity proof) plus an explicit acknowledgment checkbox. Every
 * record the member owns (RecoveryKey, Tool, Skill, Loan, Message) is purged
 * via the schema's onDelete: Cascade relations; tools the member currently
 * holds as a borrower are released back to AVAILABLE inside the same
 * transaction so no tool stays locked in BORROWED after the loan rows cascade
 * away. Guardrail: the last administrator cannot self-delete (admin lockout).
 * The client signs the burned session out after a successful purge.
 */
export async function deleteOwnAccount(
  prevState: { success?: boolean; error?: string } | undefined,
  formData: FormData
) {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Authentication required" };
  }

  // Destructive + password-verified: throttle repeat attempts
  // (PHASE_23_RATE_LIMITING).
  const limit = await enforceRateLimit("deleteAccount");
  if (!limit.ok) {
    return { success: false, error: rateLimitMessage(limit.retryAfterSeconds) };
  }

  const parsed = deleteOwnAccountSchema.safeParse({
    password: formData.get("password"),
    // FormData.get() yields null for an unchecked/absent checkbox; zod
    // .optional() rejects null — normalize to undefined.
    acknowledge: formData.get("acknowledge") ?? undefined,
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message };
  }

  if (parsed.data.acknowledge !== "true") {
    return { success: false, error: "You must acknowledge the permanent deletion notice" };
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) {
    return { success: false, error: "User not found" };
  }

  const isValid = await bcrypt.compare(parsed.data.password, user.passwordHash);
  if (!isValid) {
    return { success: false, error: "Current password is incorrect" };
  }

  if (user.role === "ADMIN") {
    const adminCount = await prisma.user.count({ where: { role: "ADMIN" } });
    if (adminCount <= 1) {
      return {
        success: false,
        error: "Cannot delete the last administrator account — promote another member first",
      };
    }
  }

  await prisma.$transaction(async (tx) => {
    const heldLoans = await tx.loan.findMany({
      where: { borrowerId: user.id, status: { in: ["APPROVED", "ACTIVE"] } },
      select: { toolId: true },
    });
    for (const loan of heldLoans) {
      await tx.tool.update({
        where: { id: loan.toolId },
        data: { status: "AVAILABLE" },
      });
    }

    await tx.user.delete({ where: { id: user.id } });
  });

  return { success: true };
}