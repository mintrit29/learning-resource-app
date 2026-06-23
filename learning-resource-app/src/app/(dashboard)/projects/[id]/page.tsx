import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight, BookOpen, Target } from "lucide-react";
import { auth } from "@/auth";
import { RecommendationRefresh } from "@/components/projects/recommendation-refresh";
import { db } from "@/lib/db";

const difficultyLabels: Record<string, string> = { BEGINNER: "Cơ bản", INTERMEDIATE: "Trung cấp", ADVANCED: "Nâng cao" };

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const project = await db.project.findFirst({
    where: { id: (await params).id, userId: session!.user.id },
    include: { recommendations: { orderBy: { score: "desc" }, include: { document: { select: { id: true, title: true, fileType: true, primaryTopic: true, difficulty: true, summary: true } } } } },
  });
  if (!project) notFound();
  return (
    <div className="page-wrap">
      <Link className="back-link" href="/projects"><ArrowLeft size={16} />Tất cả projects</Link>
      <header className="project-detail-header"><div><p className="eyebrow">Research project</p><h1>{project.title}</h1><p>{project.description}</p><div className="project-tags">{project.targetDifficulty ? <span><Target size={12} />{difficultyLabels[project.targetDifficulty]}</span> : null}{project.keywords.map((keyword) => <span key={keyword}>{keyword}</span>)}</div></div><RecommendationRefresh projectId={project.id} /></header>
      <div className="recommend-heading"><div><h2>Tài liệu được gợi ý</h2><p>Xếp hạng từ semantic search, topic, độ khó và canonical tags.</p></div><strong>{project.recommendations.length} kết quả</strong></div>
      {project.recommendations.length ? <section className="recommend-list">{project.recommendations.map((item, index) => (
        <Link href={`/documents/${item.documentId}${item.bestChunkId ? `?chunk=${item.bestChunkId}#matched-chunk` : ""}`} key={item.id}>
          <span className="recommend-rank">{index + 1}</span><div className="recommend-main"><div><span>{item.document.fileType}</span><h3>{item.document.title}</h3></div><p>{item.reason ?? item.document.summary}</p><div className="project-tags">{item.document.primaryTopic ? <span>{item.document.primaryTopic}</span> : null}{item.document.difficulty ? <span>{difficultyLabels[item.document.difficulty]}</span> : null}</div></div><aside><strong>{Math.round(item.score * 100)}%</strong><small>điểm phù hợp</small><ArrowUpRight size={17} /></aside>
        </Link>
      ))}</section> : <section className="content-section project-empty"><div className="empty-state"><div className="empty-icon"><BookOpen size={24} /></div><h2>Chưa có tài liệu phù hợp</h2><p>Hãy tải và xử lý thêm tài liệu, sau đó chọn “Tạo lại gợi ý”.</p></div></section>}
    </div>
  );
}
