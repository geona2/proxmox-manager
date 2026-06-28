import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Proxmox Datacenter Manager",
  description: "Real-time resource utilization and VM state manager for multiple Proxmox VE servers.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased dark">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
