import { LoginCard } from "@/components/login"
import { getServerAuthSession } from "@/server/auth"
import { redirect } from "next/navigation"

export default async function SignInPage() {
  const session = await getServerAuthSession()

  // If already logged in, redirect to home
  if (session) {
    redirect("/")
  }

  return (
    <div className="min-h-screen bg-[#020817] flex items-center justify-center">
      <div className="max-w-md w-full p-6">
        <h1 className="text-3xl font-bold text-white text-center mb-8">Sign in to BingoScape</h1>
        <LoginCard />
        <p className="text-sm text-[#677da2] mt-4 text-center">
          New to BingoScape? Sign in to create your account and get started.
        </p>
      </div>
    </div>
  )
}
