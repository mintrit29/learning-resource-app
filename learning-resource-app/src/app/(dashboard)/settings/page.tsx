import Link from "next/link";
import { Bot, ChevronRight, Tags } from "lucide-react";

export default function SettingsPage() {
  return <div className="page-wrap narrow"><header className="page-header"><div><p className="eyebrow">Workspace settings</p><h1>Cài đặt</h1><p>Quản lý AI providers và hệ thống chủ đề.</p></div></header><div className="settings-list"><Link href="/settings/ai-providers"><span><Bot size={21} /></span><div><strong>AI Providers</strong><p>OpenRouter, Ollama, Custom API và OpenAI Codex.</p></div><ChevronRight size={18} /></Link><Link href="/settings/tags"><span><Tags size={21} /></span><div><strong>Chủ đề và tags</strong><p>Canonical tags, aliases và đề xuất gộp chủ đề.</p></div><ChevronRight size={18} /></Link></div></div>;
}
