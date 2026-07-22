import { auth } from "@/auth";
import { ResourceSearch } from "@/components/search/semantic-search";
import { db } from "@/lib/db";

export default async function SearchPage() {
  const session = await auth();
  const topicRows = await db.document.findMany({
    where: { userId: session!.user.id, primaryTopic: { not: null } },
    distinct: ["primaryTopic"],
    orderBy: { primaryTopic: "asc" },
    select: { primaryTopic: true },
  });
  const topics = topicRows.flatMap((row) => row.primaryTopic ? [row.primaryTopic] : []);

  return (
    <div className="page-wrap">
      <header className="page-header">
        <div>
          <p className="eyebrow">Nguồn tham khảo</p>
          <h1>Tìm tài liệu phù hợp</h1>
          <p>
            Mô tả nhu cầu cho Research Project. ScholarFlow tìm theo ý nghĩa, kết hợp từ khóa và dữ liệu phân loại để chọn tài liệu phù hợp.
          </p>
        </div>
      </header>
      <ResourceSearch topics={topics} />
    </div>
  );
}
