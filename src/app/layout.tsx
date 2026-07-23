import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { ChatWidget } from "@/components/chat-widget";

const inter = Inter({
  subsets: ["latin", "cyrillic"],
  variable: "--font-sans",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "NextTTS — O‘zbek tilida sun’iy ovoz",
  description:
    "O‘zbek tilida self-hosted TTS platformasi. Matnni ravon o‘zbek nutqiga aylantiring — ta’lim, kontent va dasturlash uchun.",
};

// FOUC oldini olish: tema + til <html> ga sahifa chizilishidan oldin qo‘yiladi.
const BOOT = `(function(){try{
  var t=localStorage.getItem('theme')||'dark';
  document.documentElement.classList.toggle('dark',t==='dark');
  var l=localStorage.getItem('lang');
  if(l){document.documentElement.lang=l;}
}catch(e){document.documentElement.classList.add('dark');}})();`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="uz"
      suppressHydrationWarning
      className={`${inter.variable} ${jetbrainsMono.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: BOOT }} />
      </head>
      <body className="min-h-screen font-sans">
        <Providers>
          {children}
          <ChatWidget />
        </Providers>
      </body>
    </html>
  );
}
