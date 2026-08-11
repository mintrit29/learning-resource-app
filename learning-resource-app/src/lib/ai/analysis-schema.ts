import { z } from "zod";

const commonAnalysisFields = {
  difficulty: z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED"]),
  language: z.string().trim().min(2).max(80),
  summary: z.string().trim().min(20).max(5000),
  reason: z.string().trim().min(10).max(2000),
};

const nullableTopicId = z.preprocess(
  (value) => value === "" || value === "null" || value === undefined ? null : value,
  z.string().trim().min(1).max(100).nullable(),
);

export const aiDocumentAnalysisSchema = z.object({
  topicId: nullableTopicId,
  confidence: z.coerce.number().min(0).max(1),
  ...commonAnalysisFields,
});

export const documentAnalysisEditSchema = z.object({
  topicId: nullableTopicId,
  ...commonAnalysisFields,
});
