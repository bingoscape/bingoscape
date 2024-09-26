import { Navbar } from "@/components/navbar";
import { RunescapeLinkPrompt } from "@/components/runescape-link-prompt";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "@/server/sessionwrapper";
import "@/styles/globals.css";

import { GeistSans } from "geist/font/sans";
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
          <Navbar />
          <RunescapeLinkPrompt />
          {children}
          <Toaster />
        </body>
      </AuthProvider>
    </html >
  );
}
