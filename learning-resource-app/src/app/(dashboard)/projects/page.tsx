import Link from "next/link";
import { FolderKanban } from "lucide-react";
import { auth } from "@/auth";
import { EmptyState } from "@/components/dashboard/empty-state";
import { ProjectForm } from "@/components/projects/project-form";
import { db } from "@/lib/db";

const difficultyLabels: Record<string, string> = {
  BEGINNER: "Cơ bản",
  INTERMEDIATE: "Trung cấp",
  ADVANCED: "Nâng cao",
};

export default async function ProjectsPage() {
  const session = await auth();
  const projects = await db.project.findMany({
    where: { userId: session!.user.id },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      description: true,
      keywords: true,
      targetDifficulty: true,
      updatedAt: true,
      _count: { select: { recommendations: true } },
    },
  });

  return (
    <div className="page-wrap">
      <header className="page-header">
        <div>
          <p className="eyebrow">Đề tài</p>
          <h1>Gom tài liệu theo mục tiêu học</h1>
          <p>
            Tạo một đề tài, ScholarFlow sẽ tìm trong thư viện và gợi ý tài liệu nên đọc trước.
          </p>
        </div>
      </header>
      <ProjectForm />
      {projects.length === 0 ? (
        <section className="content-section project-empty">
          <EmptyState
            icon={FolderKanban}
            title="Bạn chưa có đề tài nào"
            description="Nếu bạn đang làm bài tập lớn, nghiên cứu hoặc muốn học một chủ đề, hãy tạo đề tài để app tự gom tài liệu liên quan."
          />
        </section>
      ) : (
        <section className="project-list">
          {projects.map((project) => (
            <Link href={`/projects/${project.id}`} key={project.id}>
              <div>
                <h2>{project.title}</h2>
                <p>{project.description}</p>
                <div className="project-tags">
                  {project.targetDifficulty ? <span>{difficultyLabels[project.targetDifficulty]}</span> : null}
                  {project.keywords.slice(0, 4).map((keyword) => (
                    <span key={keyword}>{keyword}</span>
                  ))}
                </div>
              </div>
              <aside>
                <strong>{project._count.recommendations}</strong>
                <small>tài liệu gợi ý</small>
                <time>{new Intl.DateTimeFormat("vi-VN").format(project.updatedAt)}</time>
              </aside>
            </Link>
          ))}
        </section>
      )}
    </div>
  );
}
