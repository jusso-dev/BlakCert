import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "BlakCert", template: "%s | BlakCert" },
  description: "Enterprise certificate lifecycle management for people and agents.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
