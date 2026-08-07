// Purpose: Root layout — fonts, metadata, auth provider wrapper.
import type { Metadata } from "next";
import { Fraunces, Source_Sans_3 } from "next/font/google";
import { AuthProvider } from "@/lib/auth";
import { ToastProvider } from "@/components/ui";
import "./globals.css";

const display = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const body = Source_Sans_3({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Student Management System",
  description: "Portfolio-ready student records, scores, and results platform",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${display.variable} ${body.variable} antialiased`}>
        <AuthProvider>
          <ToastProvider>{children}</ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
