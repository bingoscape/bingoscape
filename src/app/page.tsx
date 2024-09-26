import EventList from "@/components/eventlist";
import { LoginCard } from "@/components/login";
import { getServerAuthSession } from "@/server/auth";
import Link from "next/link";
import Image from "next/image";

export default async function HomePage() {
  const session = await getServerAuthSession()
  return (
    <div className="min-h-screen bg-gray-100">
      <main className="container mx-auto px-4 py-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-primary mb-2">BingoScape</h1>
          <p className="text-xl text-gray-600">RuneScape Bingos made ez</p>
        </div>
        {session ? (
          <div>
            <EventList userId={session.user.id} />
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <div className="mb-8">
              Already have an account?
            </div>
            <LoginCard />
          </div>
        )}
      </main>
    </div>
  );
}
