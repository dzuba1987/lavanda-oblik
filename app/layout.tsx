import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth/AuthContext";
import { Toaster } from "@/components/ui/sonner";
import { PWARegister } from "@/components/PWARegister";
import { BootLoader } from "@/components/BootLoader";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "cyrillic"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin", "cyrillic"],
});

export const metadata: Metadata = {
  title: "ЛавандаОблік",
  description: "Облік витрат і продажів Лавандового поля",
  manifest: "/manifest.json",
  applicationName: "ЛавандаОблік",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "ЛавандаОблік",
  },
  icons: {
    icon: [
      { url: "/favicon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
    shortcut: "/favicon-32.png",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#7c5cbb",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="uk"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        {/* Raw CSS — обходить Lightning CSS, який інакше викидає
            -webkit-appearance префікс, без якого Chromium на macOS залишає
            scrollbar у overlay (autohide) режимі і він не видно у dropdown'ах. */}
        <style
          dangerouslySetInnerHTML={{
            __html: `.thin-scrollbar::-webkit-scrollbar{-webkit-appearance:none!important;width:10px;height:10px}`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <BootLoader />
        <AuthProvider>{children}</AuthProvider>
        <Toaster richColors position="top-center" />
        <PWARegister />
      </body>
    </html>
  );
}
