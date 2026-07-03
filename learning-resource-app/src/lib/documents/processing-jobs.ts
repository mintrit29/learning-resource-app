import { JobStatus, type JobType } from "@/generated/prisma/enums";
import { db } from "@/lib/db";

export async function resetDocumentJob(documentId: string, type: JobType) {
  const existingJob = await db.analysisJob.findFirst({
    where: { documentId, type },
    orderBy: { createdAt: "desc" },
  });

  const data = {
    status: JobStatus.PENDING,
    progress: 0,
    errorMessage: null,
    startedAt: null,
    finishedAt: null,
  };

  if (existingJob) {
    return db.analysisJob.update({
      where: { id: existingJob.id },
      data,
    });
  }

  return db.analysisJob.create({
    data: { documentId, type, ...data },
  });
}
