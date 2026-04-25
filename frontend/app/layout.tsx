import type { Metadata } from "next";
import { Space_Grotesk, Source_Serif_4 } from "next/font/google";
import "./globals.css";

const headingFont = Space_Grotesk({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const bodyFont = Source_Serif_4({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AI MUN Research Assistant",
  description: "Local-LLM MUN strategy cockpit with memory, retrieval, and argument generation.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${headingFont.variable} ${bodyFont.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
