import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight, BookOpen, ListChecks, Target } from "lucide-react";
import { auth } from "@/auth";
import { DeleteProjectButton } from "@/components/projects/delete-project-button";
import { RecommendationRefresh } from "@/components/projects/recommendation-refresh";
import { db } from "@/lib/db";

const difficultyLabels: Record<string, string> = {
  BEGINNER: "Cơ bản",
  INTERMEDIATE: "Trung cấp",
  ADVANCED: "Nâng cao",
};

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const { id } = await params;
  const project = await db.project.findFirst({
    where: { id, userId: session!.user.id },
    include: {
      recommendations: {
        orderBy: { score: "desc" },
        include: {
          document: {
            select: {
              id: true,
              title: true,
              fileType: true,
              primaryTopic: true,
              difficulty: true,
              summary: true,
            },
          },
        },
      },
    },
  });
  if (!project) notFound();

  const beginnerDocs = project.recommendations
    .filter((item) => item.document.difficulty === "BEGINNER" || item.document.difficulty === "INTERMEDIATE")
    .slice(0, 3);
  const coreDocs = project.recommendations.slice(0, 4);
  const advancedDocs = project.recommendations
    .filter((item) => item.document.difficulty === "ADVANCED")
    .slice(0, 3);
  const outline = [
    {
      title: "1. Nắm tổng quan đề tài",
      description: "Đọc mô tả project, keywords và các tài liệu dễ/trung cấp trước để có nền.",
      items: beginnerDocs.length ? beginnerDocs : coreDocs.slice(0, 2),
    },
    {
      title: "2. Đọc tài liệu trọng tâm",
      description: "Ưu tiên các tài liệu có điểm phù hợp cao nhất với đề tài.",
      items: coreDocs.slice(0, 3),
    },
    {
      title: "3. Mở rộng hoặc đào sâu",
      description: "Dùng tài liệu nâng cao để bổ sung phương pháp, thuật ngữ và hướng triển khai.",
      items: advancedDocs.length ? advancedDocs : coreDocs.slice(2, 4),
    },
  ];

  return (
    <div className="page-wrap">
      <Link className="back-link" href="/projects">
        <ArrowLeft size={16} />
        Tất cả đề tài
      </Link>
      <header className="project-detail-header">
        <div>
          <p className="eyebrow">Đề tài</p>
          <h1>{project.title}</h1>
          <p>{project.description}</p>
          <div className="project-tags">
            {project.targetDifficulty ? (
              <span>
                <Target size={12} />
                {difficultyLabels[project.targetDifficulty]}
              </span>
            ) : null}
            {project.keywords.map((keyword) => (
              <span key={keyword}>{keyword}</span>
            ))}
          </div>
        </div>
        <div className="project-detail-actions">
          <RecommendationRefresh projectId={project.id} />
          <DeleteProjectButton projectId={project.id} projectTitle={project.title} />
        </div>
      </header>

      {project.recommendations.length ? (
        <section className="project-outline">
          <div className="recommend-heading">
            <div>
              <h2>Gợi ý outline đọc tài liệu</h2>
              <p>Dùng như lộ trình ban đầu để đọc và triển khai project.</p>
            </div>
            <ListChecks size={22} />
          </div>
          <div className="outline-grid">
            {outline.map((section) => (
              <article key={section.title}>
                <h3>{section.title}</h3>
                <p>{section.description}</p>
                <ul>
                  {section.items.map((item) => (
                    <li key={item.id}>
                      <Link href={`/documents/${item.documentId}${item.bestChunkId ? `?chunk=${item.bestChunkId}#matched-chunk` : ""}`}>
                        {item.document.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <div className="recommend-heading">
        <div>
          <h2>Tài liệu được gợi ý</h2>
          <p>Xếp hạng từ semantic search, topic, độ khó và canonical tags.</p>
        </div>
        <strong>{project.recommendations.length} kết quả</strong>
      </div>
      {project.recommendations.length ? (
        <section className="recommend-list">
          {project.recommendations.map((item, index) => (
            <Link href={`/documents/${item.documentId}${item.bestChunkId ? `?chunk=${item.bestChunkId}#matched-chunk` : ""}`} key={item.id}>
              <span className="recommend-rank">{index + 1}</span>
              <div className="recommend-main">
                <div>
                  <span>{item.document.fileType}</span>
                  <h3>{item.document.title}</h3>
                </div>
                <p>{item.reason ?? item.document.summary}</p>
                <div className="project-tags">
                  {item.document.primaryTopic ? <span>{item.document.primaryTopic}</span> : null}
                  {item.document.difficulty ? <span>{difficultyLabels[item.document.difficulty]}</span> : null}
                </div>
              </div>
              <aside>
                <strong>{Math.round(item.score * 100)}%</strong>
                <small>điểm phù hợp</small>
                <ArrowUpRight size={17} />
              </aside>
            </Link>
          ))}
        </section>
      ) : (
        <section className="content-section project-empty">
          <div className="empty-state">
            <div className="empty-icon">
              <BookOpen size={24} />
            </div>
            <h2>Chưa có tài liệu phù hợp</h2>
            <p>Hãy tải và xử lý thêm tài liệu, sau đó chọn “Tạo lại gợi ý”.</p>
          </div>
        </section>
      )}
    </div>
  );
}
