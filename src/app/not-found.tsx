import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import { FileQuestion } from "lucide-react"
import Link from "next/link"

export default function NotFound() {
  return (
    <div className="container mx-auto flex min-h-[50vh] items-center justify-center py-10">
      <Card className="mx-auto max-w-md">
        <CardHeader>
          <div className="mb-2 flex items-center gap-2 text-muted-foreground">
            <FileQuestion className="h-5 w-5" />
            <CardTitle>Page not found</CardTitle>
          </div>
          <CardDescription>
            The page you are looking for does not exist or you do not have
            access to it.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            If you followed a link, it may be outdated.
          </p>
        </CardContent>
        <CardFooter>
          <Button asChild>
            <Link href="/">Return home</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
