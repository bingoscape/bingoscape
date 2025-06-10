import { NextResponse } from "next/server"
import { isSuperAdmin } from "@/lib/super-admin"

export async function GET() {
  try {
    const isAdmin = await isSuperAdmin()

    return NextResponse.json({ isSuperAdmin: isAdmin })
  } catch (error) {
    console.error("Error checking super admin status:", error)
    return NextResponse.json({ isSuperAdmin: false })
  }
}
