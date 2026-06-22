import { z } from "zod";

export const analysisTopics = [
  "Artificial Intelligence",
  "Machine Learning",
  "Database",
  "Cybersecurity",
  "Web Development",
  "Software Engineering",
  "Computer Networks",
  "Mathematics",
  "Data Science",
  "Language Learning",
  "Other",
] as const;

export const documentAnalysisSchema = z.object({
  topic: z.enum(analysisTopics),
  difficulty: z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED"]),
  summary: z.string().trim().min(20).max(5000),
  subtopics: z.array(z.string().trim().min(2).max(100)).min(2).max(12),
  keywords: z.array(z.string().trim().min(1).max(80)).min(3).max(30),
  reason: z.string().trim().min(10).max(2000),
});
