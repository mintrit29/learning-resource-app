import { z } from "zod";

export const loginSchema = z.object({
  email: z.email("Email không hợp lệ").trim().toLowerCase(),
  password: z.string().min(8, "Mật khẩu phải có ít nhất 8 ký tự"),
});

export const registerSchema = loginSchema.extend({
  name: z.string().trim().min(2, "Tên phải có ít nhất 2 ký tự").max(80),
});
