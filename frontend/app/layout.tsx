import type { Metadata } from "next";
import Nav from "@/components/Nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "Doc Q&A",
  description: "Upload plain-text documents and ask questions about them.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>
        <header className="header">
          <span className="brand">Doc Q&amp;A</span>
          <Nav />
        </header>
        <main className="main">{children}</main>
      </body>
    </html>
  );
}
