import { Navbar } from "@/components/navbar";
import { RunescapeLinkPrompt } from "@/components/runescape-link-prompt";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "@/server/sessionwrapper";
import "@/styles/globals.css";
import '@mdxeditor/editor/style.css'

import { type Metadata } from "next";

export const metadata: Metadata = {
  title: "BingoScape Next",
  description: "RuneScape Clan Bingo Management Tool",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`font-sans`}>
      <AuthProvider>
        <body>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
            <Navbar />
            <RunescapeLinkPrompt />
            {children}
            <Toaster />
          </ThemeProvider >
        </body>
      </AuthProvider>
    </html >
  );
}
