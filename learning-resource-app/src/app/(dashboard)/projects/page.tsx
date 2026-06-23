import Link from "next/link";
import { FolderKanban } from "lucide-react";
import { auth } from "@/auth";
import { EmptyState } from "@/components/dashboard/empty-state";
import { ProjectForm } from "@/components/projects/project-form";
import { db } from "@/lib/db";

const difficultyLabels: Record<string, string> = { BEGINNER: "Cơ bản", INTERMEDIATE: "Trung cấp", ADVANCED: "Nâng cao" };

export default async function ProjectsPage() {
  const session = await auth();
  const projects = await db.project.findMany({
    where: { userId: session!.user.id },
    orderBy: { updatedAt: "desc" },
    select: { id: true, title: true, description: true, keywords: true, targetDifficulty: true, updatedAt: true, _count: { select: { recommendations: true } } },
  });
  return (
    <div className="page-wrap">
      <header className="page-header"><div><p className="eyebrow">Research workspace</p><h1>Projects</h1><p>Mô tả đề tài để ScholarFlow xây dựng danh sách đọc phù hợp.</p></div></header>
      <ProjectForm />
      {projects.length === 0 ? (
        <section className="content-section project-empty"><EmptyState icon={FolderKanban} title="Chưa có Research Project" description="Project đầu tiên sẽ xuất hiện ở đây cùng các tài liệu được đề xuất." /></section>
      ) : (
        <section className="project-list">
          {projects.map((project) => (
            <Link href={`/projects/${project.id}`} key={project.id}>
              <div><h2>{project.title}</h2><p>{project.description}</p><div className="project-tags">{project.targetDifficulty ? <span>{difficultyLabels[project.targetDifficulty]}</span> : null}{project.keywords.slice(0, 4).map((keyword) => <span key={keyword}>{keyword}</span>)}</div></div>
              <aside><strong>{project._count.recommendations}</strong><small>tài liệu gợi ý</small><time>{new Intl.DateTimeFormat("vi-VN").format(project.updatedAt)}</time></aside>
            </Link>
          ))}
        </section>
      )}
    </div>
  );
}
