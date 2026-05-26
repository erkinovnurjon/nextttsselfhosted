import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/sidebar";
import { TopBar } from "@/components/top-bar";

export const metadata: Metadata = {
  title: "NextTTS — Self-hosted TTS Studio",
  description:
    "O'zbek tilida self-hosted TTS platformasi. Dataset to'plash, fine-tuning, voice cloning sinov muhiti.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="uz" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme')||'dark';document.documentElement.classList.toggle('dark',t==='dark');}catch(e){document.documentElement.classList.add('dark');}})();`,
          }}
        />
      </head>
      <body className="min-h-screen">
        <div className="flex min-h-screen">
          <Sidebar />
          <div className="flex flex-1 flex-col min-w-0">
            <TopBar />
            <div className="flex-1">{children}</div>
          </div>
        </div>
      </body>
    </html>
  );
}
