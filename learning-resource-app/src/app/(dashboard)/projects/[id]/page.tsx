import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight, BookOpen, Sparkles, Target } from "lucide-react";
import { auth } from "@/auth";
import { DeleteProjectButton } from "@/components/projects/delete-project-button";
import { RecommendationRefresh } from "@/components/projects/recommendation-refresh";
import { db } from "@/lib/db";
import { formatDifficulty } from "@/lib/labels";

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

  const priorityLabels = ["Nên đọc trước", "Đọc tiếp theo", "Có thể tham khảo", "Đọc khi cần đào sâu"];
  const readingSuggestions = project.recommendations.slice(0, 4);

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
                {formatDifficulty(project.targetDifficulty)}
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
              <h2>AI đề xuất cách đọc</h2>
              <p>AI đọc các tài liệu phù hợp nhất rồi gợi ý nên đọc cái nào trước và vì sao.</p>
            </div>
            <Sparkles size={22} />
          </div>
          <div className="ai-reading-plan">
            {readingSuggestions.map((item, index) => (
              <Link href={`/documents/${item.documentId}${item.bestChunkId ? `?chunk=${item.bestChunkId}#matched-chunk` : ""}`} key={item.id}>
                <span>{index + 1}</span>
                <div>
                  <small>{priorityLabels[index] ?? "Tham khảo thêm"}</small>
                  <h3>{item.document.title}</h3>
                  <p>{item.reason ?? item.document.summary ?? "Tài liệu này có mức phù hợp cao với đề tài."}</p>
                </div>
                <ArrowUpRight size={17} />
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <div className="recommend-heading">
        <div>
          <h2>Tài liệu được gợi ý</h2>
          <p>Xếp hạng từ tìm kiếm ngữ nghĩa, chủ đề, độ khó và thẻ chuẩn hóa.</p>
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
                  {item.document.difficulty ? <span>{formatDifficulty(item.document.difficulty)}</span> : null}
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
