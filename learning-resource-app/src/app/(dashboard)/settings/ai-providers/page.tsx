import { auth } from "@/auth";
import { AiProviderManager } from "@/components/settings/ai-provider-manager";
import { publicProvider } from "@/lib/ai/provider-config";
import { db } from "@/lib/db";

export default async function AiProvidersPage() {
  const session = await auth();
  const providers = session?.user?.id ? await db.aiProvider.findMany({ where: { userId: session.user.id }, orderBy: [{ isActive: "desc" }, { createdAt: "desc" }] }) : [];
  return <div className="page-wrap"><header className="page-header"><div><p className="eyebrow">AI configuration</p><h1>AI Providers</h1><p>Kết nối model dùng để phân tích và phân loại tài liệu.</p></div></header><section className="content-section provider-section"><AiProviderManager initialProviders={providers.map(publicProvider)} /></section></div>;
}
