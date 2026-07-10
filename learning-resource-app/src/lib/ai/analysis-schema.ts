import { z } from "zod";

export const documentAnalysisSchema = z.object({
  topic: z.string().trim().min(2).max(100),
  topicAliases: z.array(z.string().trim().min(2).max(100)).max(12).default([]),
  difficulty: z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED"]),
  language: z.string().trim().min(2).max(80),
  summary: z.string().trim().min(20).max(5000),
  subtopics: z.array(z.string().trim().min(2).max(100)).min(2).max(12),
  keywords: z.array(z.string().trim().min(1).max(80)).min(3).max(30),
  reason: z.string().trim().min(10).max(2000),
});
