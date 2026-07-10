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

console.log(JSON.stringify({ email, password, userId: user.id }, null, 2));
await db.$disconnect();
