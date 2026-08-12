// Purpose: Shared flat SVG icons for nav + portal feature labels.
import type { ReactNode } from "react";

type IconProps = { className?: string };

function Svg({ className, children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className ?? "h-5 w-5 shrink-0 fill-none stroke-current stroke-2"}
      aria-hidden
    >
      {children}
    </svg>
  );
}

export function IconDashboard(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M4 4h7v7H4zM13 4h7v5h-7zM13 11h7v9h-7zM4 13h7v7H4z" strokeLinejoin="round" />
    </Svg>
  );
}

export function IconStudents(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 3 3 8l9 5 9-5-9-5Z" strokeLinejoin="round" />
      <path d="M5 10.5V16c0 1.5 3 3 7 3s7-1.5 7-3v-5.5" strokeLinecap="round" />
    </Svg>
  );
}

export function IconClasses(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M4 5h16v12H4z" strokeLinejoin="round" />
      <path d="M8 21h8M12 17v4" strokeLinecap="round" />
      <path d="M8 9h8M8 12h5" strokeLinecap="round" />
    </Svg>
  );
}

export function IconTeachers(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c1.5-3.5 4-5 7-5s5.5 1.5 7 5" strokeLinecap="round" />
    </Svg>
  );
}

export function IconSubjects(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M4 5h7a3 3 0 0 1 3 3v11H7a3 3 0 0 0-3 3V5Z" strokeLinejoin="round" />
      <path d="M20 5h-7a3 3 0 0 0-3 3v11h7a3 3 0 0 1 3 3V5Z" strokeLinejoin="round" />
    </Svg>
  );
}

export function IconEnrollments(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M8 6h12M8 12h12M8 18h12" strokeLinecap="round" />
      <path d="M4 6.5 5 7.5 6.5 5.5M4 12.5 5 13.5 6.5 11.5M4 18.5 5 19.5 6.5 17.5" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function IconSession(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="3.5" y="5" width="17" height="15" rx="2" />
      <path d="M8 3v4M16 3v4M3.5 10h17" strokeLinecap="round" />
    </Svg>
  );
}

export function IconScores(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M8 4h8l3 3v13H5V4h3Z" strokeLinejoin="round" />
      <path d="M9 12h6M9 16h4" strokeLinecap="round" />
    </Svg>
  );
}

export function IconAnnouncements(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M4 10v4h3l6 4V6L7 10H4Z" strokeLinejoin="round" />
      <path d="M17 9.5a3.5 3.5 0 0 1 0 5M19.5 7.5a6.5 6.5 0 0 1 0 9" strokeLinecap="round" />
    </Svg>
  );
}

export function IconResults(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M7 3h10v18H7z" strokeLinejoin="round" />
      <path d="M10 8h4M10 12h4M10 16h2" strokeLinecap="round" />
    </Svg>
  );
}

export function IconSchools(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M3 20h18M5 20V9l7-4 7 4v11M9 20v-5h6v5" strokeLinejoin="round" />
    </Svg>
  );
}

export function IconAdmin(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c1.5-3.5 4-5 7-5s5.5 1.5 7 5" strokeLinecap="round" />
      <path d="M17 4.5 18.5 6 21 3.5" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function IconTeacherPortal(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M4 19V7l8-3 8 3v12" strokeLinejoin="round" />
      <path d="M9 11h6M9 15h4" strokeLinecap="round" />
    </Svg>
  );
}

export function IconStudentPortal(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 3 3 8l9 5 9-5-9-5Z" strokeLinejoin="round" />
      <path d="M7 11v5c2 1.5 4 2 5 2s3-.5 5-2v-5" strokeLinecap="round" />
    </Svg>
  );
}

export const NAV_ICONS: Record<string, (p: IconProps) => ReactNode> = {
  Dashboard: IconDashboard,
  Students: IconStudents,
  Classes: IconClasses,
  Teachers: IconTeachers,
  Subjects: IconSubjects,
  Enrollments: IconEnrollments,
  Session: IconSession,
  Scores: IconScores,
  Announcements: IconAnnouncements,
  "My Results": IconResults,
  Schools: IconSchools,
};
