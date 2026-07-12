import { auth } from "@/auth";
import { TagManager } from "@/components/settings/tag-manager";
import { TagMergeReviewList } from "@/components/settings/tag-merge-review-list";
import { db } from "@/lib/db";

export default async function TopicsPage() {
  const session = await auth();
  const userId = session!.user.id;
  const tags = await db.tag.findMany({
    where: { createdByUserId: userId },
    select: {
      id: true,
      name: true,
      normalizedName: true,
      description: true,
      aliases: {
        select: { id: true, alias: true },
        orderBy: { alias: "asc" },
      },
      _count: { select: { aliases: true, documents: true } },
    },
    orderBy: { name: "asc" },
  });
  const reviews = await db.tagMergeReview.findMany({
    where: { userId, status: "PENDING" },
    select: {
      id: true,
      candidateTagName: true,
      similarity: true,
      suggestedTag: { select: { name: true } },
      document: { select: { title: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="page-wrap">
      <header className="page-header">
        <div>
          <p className="eyebrow">Chủ đề</p>
          <h1>Chủ đề chuẩn & tên gọi khác</h1>
          <p>Gom các cách gọi giống nhau về một chủ đề để thư viện dễ lọc và tìm hơn.</p>
        </div>
      </header>
      <section className="content-section tag-section">
        <TagManager initialTags={tags} />
      </section>
      <TagMergeReviewList reviews={reviews} />
    </div>
  );
}
