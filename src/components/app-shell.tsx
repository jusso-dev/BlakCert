import Link from "next/link";
import {
  Activity,
  BadgeCheck,
  Bot,
  Boxes,
  Cable,
  ClipboardCheck,
  FileClock,
  FileKey,
  Gauge,
  KeyRound,
  LayoutDashboard,
  Network,
  ScrollText,
  Search,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Store,
  Users,
} from "lucide-react";
import { Brand } from "./brand";

const primary = [
  ["Overview", "/overview", LayoutDashboard],
  ["Certificates", "/certificates", FileKey],
  ["Deployments", "/deployments", Boxes],
  ["Requests", "/requests", ClipboardCheck],
  ["Renewals", "/renewals", FileClock],
  ["Discovery", "/discovery", Search],
  ["Certificate Authorities", "/certificate-authorities", BadgeCheck],
  ["Trust Stores", "/trust-stores", Store],
  ["Policies", "/policies", ShieldCheck],
  ["Risks", "/risks", ShieldAlert],
  ["Approvals", "/approvals", ClipboardCheck],
  ["Agents", "/agents", Bot],
  ["Reports", "/reports", Gauge],
  ["Audit", "/audit", ScrollText],
] as const;

const admin = [
  ["Users & access", "/administration/users", Users],
  ["Connectors", "/administration/connectors", Cable],
  ["API & MCP", "/administration/api", Network],
  ["Security", "/administration/security", KeyRound],
  ["System health", "/administration/health", Activity],
  ["Administration", "/administration", Settings],
] as const;

export function AppShell({
  organisationName,
  userName,
  children,
}: {
  organisationName: string;
  userName: string;
  children: React.ReactNode;
}) {
  return (
    <div className="shell">
      <aside className="sidebar" aria-label="Primary navigation">
        <Brand />
        <nav className="nav">
          {primary.map(([label, href, Icon]) => (
            <Link className="nav-link" href={href} key={href}>
              <Icon size={16} aria-hidden="true" />
              <span>{label}</span>
            </Link>
          ))}
          <div className="nav-label">Administration</div>
          {admin.map(([label, href, Icon]) => (
            <Link className="nav-link" href={href} key={href}>
              <Icon size={16} aria-hidden="true" />
              <span>{label}</span>
            </Link>
          ))}
        </nav>
      </aside>
      <div>
        <header className="context-bar">
          <div className="context-org">
            <ShieldCheck size={16} aria-hidden="true" />
            {organisationName}
          </div>
          <span className="muted">{userName}</span>
        </header>
        <main>{children}</main>
      </div>
    </div>
  );
}
