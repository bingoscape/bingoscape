import EventList from "@/components/eventlist";
import { LoginCard } from "@/components/login";
import { getServerAuthSession } from "@/server/auth";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default async function HomePage() {
  const session = await getServerAuthSession()

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-primary mb-2">BingoScape</h1>
          <p className="text-xl text-muted-foreground">RuneScape Bingos made ez</p>
        </div>
        {session ? (
          <div className="space-y-8">
            <EventList userId={session.user.id} />
          </div>
        ) : (
          <div className="flex flex-col items-center space-y-6">
            <p className="text-lg text-muted-foreground">
              Already have an account? Sign in to start creating and joining bingo events!
            </p>
            <LoginCard />
            <p className="text-sm text-muted-foreground">
              New to BingoScape? Sign in to create your account and get started.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

