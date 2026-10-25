"use server";

import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { generateRecoveryCodes, hashRecoveryCode } from "@/lib/crypto";

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

  // The actual authentication is handled by NextAuth's credentials provider
  // This action is just for form validation before calling signIn
  return { success: true };
}

export async function logoutAction() {
  // The actual logout is handled by NextAuth's signOut
  // This is a placeholder for any server-side cleanup if needed
  return { success: true };
}