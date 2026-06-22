import { auth } from "@/auth";
import { TagManager } from "@/components/settings/tag-manager";
import { db } from "@/lib/db";

export default async function TagsPage() {
  const session = await auth();
  const tags = await db.tag.findMany({ where: { createdByUserId: session!.user.id }, select: { id: true, name: true, normalizedName: true, description: true, _count: { select: { aliases: true, documents: true } } }, orderBy: { name: "asc" } });
  return <div className="page-wrap"><header className="page-header"><div><p className="eyebrow">Taxonomy</p><h1>Chủ đề và tags</h1><p>Chuẩn hóa các tên chủ đề do AI tạo ra.</p></div></header><section className="content-section tag-section"><TagManager initialTags={tags} /></section></div>;
}
