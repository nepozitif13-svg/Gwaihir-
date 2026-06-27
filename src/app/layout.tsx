import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Gwaihir — model-layer auditor & recon",
  description:
    "Probe language models and score what they reveal. Memorization audit (Mode A) and model-layer recon (Mode B).",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
