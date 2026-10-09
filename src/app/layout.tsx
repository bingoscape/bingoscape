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
import localFont from "next/font/local"

const body = Noto_Sans({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
})
// Old School RuneScape bitmap font (CC0, github.com/runestar/fonts). Native size is 16px.
const pixel = localFont({
  src: "../fonts/RuneScape-Bold-12.ttf",
  variable: "--font-pixel",
  display: "swap",
})

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
    <html lang="en" className={`${body.variable} ${pixel.variable}`} suppressHydrationWarning>
      <AuthProvider>
        <body>
          <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
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
