import { z } from "zod";

export const analysisTopics = [
  "Artificial Intelligence",
  "Machine Learning",
  "Natural Language Processing",
  "Computer Vision",
  "Database",
  "Cybersecurity",
  "Web Development",
  "Mobile Development",
  "Software Engineering",
  "Computer Networks",
  "Operating Systems",
  "Cloud Computing",
  "Mathematics for Computing",
  "Data Science",
  "Other",
] as const;

export const documentAnalysisSchema = z.object({
  topic: z.enum(analysisTopics),
  difficulty: z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED"]),
  language: z.string().trim().min(2).max(80),
  summary: z.string().trim().min(20).max(5000),
  subtopics: z.array(z.string().trim().min(2).max(100)).min(2).max(12),
  keywords: z.array(z.string().trim().min(1).max(80)).min(3).max(30),
  reason: z.string().trim().min(10).max(2000),
});
