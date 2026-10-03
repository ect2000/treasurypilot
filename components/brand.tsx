import { ArrowUpRight } from "lucide-react";
export function Brand({ small = false }: { small?: boolean }) {
  return (
    <span className={`brand ${small ? "brand-small" : ""}`}>
      <span className="brand-mark">
        <ArrowUpRight size={19} strokeWidth={2.8} />
      </span>
      TreasuryPilot<span className="brand-period">.</span>
    </span>
  );
}
export function SandboxBadge() {
  return (
    <span className="sandbox-badge">
      <span />
      SANDBOX
    </span>
  );
}
