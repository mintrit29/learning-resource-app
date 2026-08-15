import { ResourceSearch } from "@/components/search/semantic-search";
import { db } from "@/lib/db";
import { ensureCurriculumTopics } from "@/lib/taxonomy/curriculum-topics";

export const dynamic = "force-dynamic";

export default async function SearchPage() {
  await ensureCurriculumTopics();
  const topicRows = await db.tag.findMany({
    where: { isClassificationEnabled: true },
    orderBy: { name: "asc" },
    select: { name: true },
  });
  const topics = topicRows.map((row) => row.name);

  return (
    <div className="page-wrap">
      <header className="page-header">
        <div>
          <p className="eyebrow">Nguồn tham khảo</p>
          <h1>Tìm tài liệu phù hợp</h1>
          <p>
            Nhập mô tả hoặc khoanh trực tiếp một vùng trên ảnh, PDF hay tài liệu. ScholarFlow chỉ tìm nguồn tương tự trong thư viện, không tự giải câu hỏi.
          </p>
        </div>
      </header>
      <ResourceSearch topics={topics} />
    </div>
  );
}
