import { RegisterCard } from "@/components/register"
import { getServerAuthSession } from "@/server/auth"
import { redirect } from "next/navigation"

export default async function SignUpPage() {
  const session = await getServerAuthSession()

  // If already logged in, redirect to home
  if (session) {
    redirect("/")
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#020817]">
      <div className="w-full max-w-md p-6">
        <h1 className="mb-8 text-center text-3xl font-bold text-white">
          Join BingoScape
        </h1>
        <RegisterCard />
      </div>
    </div>
  )
}
