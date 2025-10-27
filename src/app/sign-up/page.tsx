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
    <div className="min-h-screen bg-[#020817] flex items-center justify-center">
      <div className="max-w-md w-full p-6">
        <h1 className="text-3xl font-bold text-white text-center mb-8">
          Join BingoScape
        </h1>
        <RegisterCard />
      </div>
    </div>
  )
}
