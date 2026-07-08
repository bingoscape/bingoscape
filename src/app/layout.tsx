import { Navbar } from "@/components/navbar"
import { isSuperAdmin } from "@/lib/super-admin"
import { RunescapeLinkPrompt } from "@/components/runescape-link-prompt"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/toaster"
import { AuthProvider } from "@/server/sessionwrapper"
import "@/styles/globals.css"
import "@mdxeditor/editor/style.css"

import { type Metadata } from "next"
import { Noto_Sans } from "next/font/google"

const noto = Noto_Sans({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "BingoScape Next",
  description: "RuneScape Clan Bingo Management Tool",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
}

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const isSuperAdminUser = await isSuperAdmin()

  return (
    <html lang="en" className={noto.className} suppressHydrationWarning>
      <AuthProvider>
        <body>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
            <Navbar isSuperAdminUser={isSuperAdminUser} />
            <RunescapeLinkPrompt />
            {children}
            <Toaster />
          </ThemeProvider>
        </body>
      </AuthProvider>
    </html>
  )
}
