import { CircleAlert, CircleCheck, CircleDot } from "lucide-react";

export function StatusBadge({ value }: { value: string }) {
  const normalised = value.toLowerCase().replaceAll("_", "-");
  const Icon = /critical|high|failed|deny|expired|revoked/.test(normalised)
    ? CircleAlert
    : /active|allow|success|valid|completed|managed/.test(normalised)
      ? CircleCheck
      : CircleDot;
  return (
    <span className={`badge badge-${normalised}`}>
      <Icon size={12} aria-hidden="true" />
      {value.replaceAll("_", " ")}
    </span>
  );
}
