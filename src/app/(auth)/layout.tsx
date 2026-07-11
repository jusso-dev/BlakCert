import { Brand } from "@/components/brand";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth-layout">
      <section className="auth-form">
        <Brand />
        {children}
      </section>
      <aside className="auth-aside" aria-label="Product statement">
        <blockquote>
          Every certificate accounted for. Every action authorised. Every decision evidenced.
        </blockquote>
      </aside>
    </div>
  );
}
