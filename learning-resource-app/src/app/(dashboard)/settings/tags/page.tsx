import { auth } from "@/auth";
import { TagManager } from "@/components/settings/tag-manager";
import { db } from "@/lib/db";
import { ensureCurriculumTopics } from "@/lib/taxonomy/curriculum-topics";

export default async function TopicsPage() {
  const session = await auth();
  const userId = session!.user.id;
  await ensureCurriculumTopics(userId);
  const tags = await db.tag.findMany({
    where: { createdByUserId: userId },
    select: {
      id: true,
      name: true,
      normalizedName: true,
      description: true,
      isClassificationEnabled: true,
      aliases: {
        select: { id: true, alias: true },
        orderBy: { alias: "asc" },
      },
      _count: { select: { aliases: true, documents: true } },
    },
    orderBy: { name: "asc" },
  });
  return (
    <div className="page-wrap">
      <header className="page-header">
        <div>
          <p className="eyebrow">Môn học</p>
          <h1>Danh sách môn học ngành CNTT</h1>
          <p>AI chỉ được phân loại tài liệu vào một môn có trong danh sách này. Bạn là người duy nhất có quyền thêm, sửa, xóa hoặc gộp môn.</p>
        </div>
      </header>
      <section className="content-section tag-section">
        <TagManager initialTags={tags} />
      </section>
    </div>
  );
}
