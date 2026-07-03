import bcrypt from "bcryptjs";
import { db } from "../src/lib/db";

const email = "demo@scholarflow.local";
const password = "demo123456";

const passwordHash = await bcrypt.hash(password, 10);

const user = await db.user.upsert({
  where: { email },
  update: { name: "Tài khoản Demo", passwordHash },
  create: { email, name: "Tài khoản Demo", passwordHash },
});

await db.project.upsert({
  where: {
    id: "demo-project-scholarflow",
  },
  update: {
    userId: user.id,
    title: "Demo: Database transaction processing",
    description: "Đề tài demo để kiểm tra gợi ý tài liệu, outline và semantic search.",
    keywords: ["Database", "Transactions", "Concurrency Control"],
    targetDifficulty: "INTERMEDIATE",
  },
  create: {
    id: "demo-project-scholarflow",
    userId: user.id,
    title: "Demo: Database transaction processing",
    description: "Đề tài demo để kiểm tra gợi ý tài liệu, outline và semantic search.",
    keywords: ["Database", "Transactions", "Concurrency Control"],
    targetDifficulty: "INTERMEDIATE",
  },
});

console.log(JSON.stringify({ email, password, userId: user.id }, null, 2));
await db.$disconnect();
