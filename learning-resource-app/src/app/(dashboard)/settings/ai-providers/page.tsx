import { AiProviderManager } from "@/components/settings/ai-provider-manager";
import { publicProvider } from "@/lib/ai/provider-config";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AiProvidersPage() {
  const providers = await db.aiProvider.findMany({
    orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
  });

  return (
    <div className="page-wrap">
      <header className="page-header">
        <div>
          <p className="eyebrow">Kết nối AI</p>
          <h1>Chọn model để phân tích tài liệu</h1>
          <p>
            Kết nối mặc định được dùng để tóm tắt và phân loại tài liệu nhằm hỗ trợ tìm kiếm.
          </p>
        </div>
      </header>
      <section className="content-section provider-section">
        <AiProviderManager initialProviders={providers.map(publicProvider)} />
      </section>
    </div>
  );
}
