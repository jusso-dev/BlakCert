import { ShieldCheck } from "lucide-react";

export function Brand() {
  return (
    <div className="brand">
      <div className="brand-mark" aria-hidden="true">
        <ShieldCheck size={17} strokeWidth={2.2} />
      </div>
      <span>BlakCert</span>
    </div>
  );
}
