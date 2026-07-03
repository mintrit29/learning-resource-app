import { auth } from "@/auth";
import { SemanticSearch } from "@/components/search/semantic-search";
import { db } from "@/lib/db";

export default async function SearchPage() {
  const session = await auth();
  const documents = await db.document.findMany({
    where: { userId: session!.user.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true, fileType: true },
  });

  return (
    <div className="page-wrap">
      <header className="page-header">
        <div>
          <p className="eyebrow">Hỏi tài liệu</p>
          <h1>Bạn muốn tìm gì?</h1>
          <p>
            Gõ câu hỏi bằng ngôn ngữ tự nhiên. ScholarFlow sẽ tìm các đoạn liên quan
            nhất trong thư viện của bạn.
          </p>
        </div>
      </header>
      <SemanticSearch documents={documents} />
    </div>
  );
}
