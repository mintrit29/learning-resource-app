import { z } from "zod";

export const tagSchema = z.object({
  name: z.string({ error: "Vui lòng nhập tên môn học." }).trim()
    .min(2, "Tên môn học phải có ít nhất 2 ký tự.")
    .max(100, "Tên môn học không được quá 100 ký tự."),
  description: z.string({ error: "Ghi chú phải là văn bản." }).trim()
    .max(500, "Ghi chú không được quá 500 ký tự.").optional().default(""),
});
