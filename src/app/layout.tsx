import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Orbitron, Share_Tech_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const orbitron = Orbitron({
  variable: "--font-orbitron",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800", "900"],
});

const techMono = Share_Tech_Mono({
  variable: "--font-tech-mono",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: "KolosalCut — Neon Studio Split & Edit Video 9:16",
  description:
    "Studio futuristik untuk edit dan split video: potong per durasi atau jumlah bagian, cover otomatis 2-3 detik, judul dari nama file, label Part/Eps urut dengan posisi geser bebas, gaya frame film kolosal & Hollywood, rasio 9:16 penuh atau biasa dengan zoom manual, serta deskripsi yang bisa digeser ke segala arah.",
  keywords: [
    "split video",
    "edit video",
    "video 9:16",
    "cover otomatis",
    "film kolosal",
    "Hollywood",
    "KolosalCut",
  ],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#04060d",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className="dark" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${orbitron.variable} ${techMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
