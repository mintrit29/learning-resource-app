import { ExternalLink, Mail } from "lucide-react";
import { PROJECT_INFO } from "@/lib/project-info";

export function ProjectFooter({ compact = false }: { compact?: boolean }) {
  return (
    <footer className={`project-footer${compact ? " compact" : ""}`}>
      <div className="project-footer-brand">
        <strong>© {PROJECT_INFO.year} {PROJECT_INFO.appName}</strong>
        <span>{PROJECT_INFO.title}</span>
      </div>
      <div className="project-footer-meta">
        <span>{PROJECT_INFO.faculty} · {PROJECT_INFO.university}</span>
        <span>Nhóm {PROJECT_INFO.group} · GVHD: {PROJECT_INFO.advisor}</span>
      </div>
      <div className="project-footer-links">
        <a href={`mailto:${PROJECT_INFO.email}`} title={`Gửi email đến ${PROJECT_INFO.email}`}>
          <Mail size={14} />Email
        </a>
        <a href={PROJECT_INFO.githubUrl} target="_blank" rel="noreferrer" title={PROJECT_INFO.githubLabel}>
          <ExternalLink size={14} />GitHub
        </a>
        <span>v{PROJECT_INFO.version}</span>
      </div>
    </footer>
  );
}
