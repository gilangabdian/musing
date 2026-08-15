import type { Metadata } from "next";
import { GeistPixelSquare } from "geist/font/pixel";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  icons: [
    {
      url: "/icon.png",
      type: "image/png",
    },
  ],
  title: "Musing",
  description: "Travel to any year you want",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={cn("h-full", "antialiased", GeistPixelSquare.className, "font-sans", geist.variable)}>
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
