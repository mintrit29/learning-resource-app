import { CircleHelp, ExternalLink, GraduationCap, Mail, Users } from "lucide-react";
import { PROJECT_INFO } from "@/lib/project-info";

export function ProjectHeader() {
  return (
    <header className="project-header">
      <div className="project-header-identity">
        <span><GraduationCap size={19} /></span>
        <div>
          <small>{PROJECT_INFO.faculty} · Nhóm {PROJECT_INFO.group}</small>
          <strong>{PROJECT_INFO.title}</strong>
        </div>
      </div>

      <details className="project-about">
        <summary><CircleHelp size={17} />Về dự án</summary>
        <section className="project-about-card">
          <div className="project-about-heading">
            <span><GraduationCap size={20} /></span>
            <div>
              <small>Đồ án {PROJECT_INFO.faculty}</small>
              <strong>{PROJECT_INFO.title}</strong>
            </div>
          </div>

          <dl className="project-about-list">
            <div><dt>Trường</dt><dd>{PROJECT_INFO.university}</dd></div>
            <div><dt>Nhóm</dt><dd>{PROJECT_INFO.group}</dd></div>
            <div><dt>Giảng viên hướng dẫn</dt><dd>{PROJECT_INFO.advisor}</dd></div>
          </dl>

          <div className="project-member-section">
            <p><Users size={15} />Thành viên thực hiện</p>
            {PROJECT_INFO.members.map((member) => (
              <div className="project-member" key={member.studentId}>
                <strong>{member.name}</strong>
                <span>MSSV {member.studentId}</span>
              </div>
            ))}
          </div>

          <div className="project-contact-links">
            <a href={`mailto:${PROJECT_INFO.email}`}><Mail size={15} />{PROJECT_INFO.email}</a>
            <a href={PROJECT_INFO.githubUrl} target="_blank" rel="noreferrer"><ExternalLink size={15} />GitHub</a>
          </div>
        </section>
      </details>
    </header>
  );
}
