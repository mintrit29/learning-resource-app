import { auth } from "@/auth";
import { AiProviderManager } from "@/components/settings/ai-provider-manager";
import { publicProvider } from "@/lib/ai/provider-config";
import { db } from "@/lib/db";

export default async function AiProvidersPage() {
  const session = await auth();
  const providers = session?.user?.id
    ? await db.aiProvider.findMany({
        where: { userId: session.user.id },
        orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
      })
    : [];

  return (
    <div className="page-wrap">
      <header className="page-header">
        <div>
          <p className="eyebrow">Kết nối AI</p>
          <h1>Chọn model để phân tích tài liệu</h1>
          <p>
            Provider mặc định sẽ được dùng khi app tóm tắt, phân loại độ khó, tạo keywords
            và gợi ý tài liệu theo đề tài.
          </p>
        </div>
      </header>
      <section className="content-section provider-section">
        <AiProviderManager initialProviders={providers.map(publicProvider)} />
      </section>
    </div>
  );
}
