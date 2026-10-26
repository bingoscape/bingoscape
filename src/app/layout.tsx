import { Navbar } from "@/components/navbar"
import {
  PROXY_DISABLED_GLOBAL,
  parseImageProxyFlag,
} from "@/lib/osrs-image"
import { isSuperAdmin } from "@/lib/super-admin"
import { RunescapeLinkPrompt } from "@/components/runescape-link-prompt"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/toaster"
import "@/styles/globals.css"
import "@mdxeditor/editor/style.css"

import { type Metadata, type Viewport } from "next"
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

// viewport-fit=cover lets the mobile Tile drawer honour env(safe-area-inset-*).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // Shrink the layout viewport when the on-screen keyboard opens so pinned dialog footers stay visible.
  interactiveWidget: "resizes-content",
}

export const metadata: Metadata = {
  title: "BingoScape - Old School RuneScape Clan Bingo",
  description:
    "Create Boards, run Clan Events and track Team progress for Old School RuneScape bingo, with RuneLite Plugin integration.",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
}

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const isSuperAdminUser = await isSuperAdmin()
  // Read per request (the layout is dynamic), so OSRS_IMAGE_PROXY=false only
  // needs a restart. Client components read the global through toProxyUrl.
  const imageProxyOff = !parseImageProxyFlag(process.env.OSRS_IMAGE_PROXY)

  return (
    <html lang="en" className={`${body.variable} ${pixel.variable}`} suppressHydrationWarning>
      {imageProxyOff ? (
        <head>
          <script
            dangerouslySetInnerHTML={{
              __html: `window.${PROXY_DISABLED_GLOBAL}=false`,
            }}
          />
        </head>
      ) : null}
      <body>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
          <Navbar isSuperAdminUser={isSuperAdminUser} />
          <RunescapeLinkPrompt />
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  )
}
