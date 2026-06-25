import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";

export const metadata: Metadata = {
  title: "AI Credits Dashboard",
  description: "Monitor AI usage and credits across providers",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="relative min-h-screen font-inter antialiased overflow-x-hidden" aria-label="App Body">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <div className="relative z-10">
            {children}
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
