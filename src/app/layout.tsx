import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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

export const metadata: Metadata = {
  title: "KolosalCut — Studio Split & Edit Video 9:16",
  description:
    "Aplikasi edit dan split video: potong per durasi atau jumlah bagian, cover otomatis 2-3 detik, judul dari nama file, label Part/Eps urut, gaya frame film kolosal & Hollywood, rasio 9:16 penuh atau biasa dengan zoom manual, serta deskripsi yang bisa digeser bebas.",
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
  themeColor: "#09090b",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className="dark" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
