import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query"] : [],
    transactionOptions: {
      maxWait: 10000,
      timeout: 15000,
    },
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;