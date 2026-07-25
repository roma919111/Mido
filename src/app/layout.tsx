import type { Metadata } from "next";
import { Outfit, Syne } from "next/font/google";
import "./globals.css";

const syne = Syne({
  variable: "--font-syne",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Veronix.ai — AI Image & Video Studio",
  description:
    "Veronix.ai studio for AI images and videos with customer accounts, assets, and subscriptions.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" className={`${syne.variable} ${outfit.variable} h-full antialiased`}>
      <body className="min-h-full overflow-x-hidden font-sans">{children}</body>
    </html>
  );
}
