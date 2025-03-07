import { getUserTemplates } from "@/app/actions/templates"
import { Breadcrumbs } from "@/components/breadcrumbs"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { getServerAuthSession } from "@/server/auth"
import { redirect } from "next/navigation"
import { CreateTemplateButton } from "@/components/create-template-button"
import { UserTemplateActions } from "@/components/user-template-actions"
import Link from "next/link"
import { formatDistanceToNow } from "date-fns"
import { Eye, EyeOff } from "lucide-react"
import { TemplatePreviewGrid } from "@/components/template-preview-grid"

export default async function MyTemplatesPage() {
  const session = await getServerAuthSession()

  if (!session?.user) {
    redirect("/login")
  }

  const templates = await getUserTemplates()

  const breadcrumbItems = [
    { label: "Home", href: "/" },
    { label: "Templates", href: "/templates" },
    { label: "My Templates", href: "/templates/my-templates" },
  ]

  return (
    <div className="container mx-auto py-10">
      <div className="flex justify-between items-center mb-6">
        <Breadcrumbs items={breadcrumbItems} />
        <CreateTemplateButton />
      </div>

      <h1 className="text-3xl font-bold mb-6">My Templates</h1>

      {templates.length === 0 ? (
        <div className="text-center py-12">
          <h2 className="text-xl font-medium mb-4">You haven&apos;t created any templates yet</h2>
          <p className="text-muted-foreground mb-6">
            Create your first template by saving one of your bingo boards as a template.
          </p>
          <CreateTemplateButton />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {templates.map((template) => (
            <Card key={template.id} className="flex flex-col">
              <CardHeader className="pb-2">
                <div className="flex justify-between">
                  <CardTitle className="line-clamp-1">{template.title}</CardTitle>
                  {template.isPublic ? (
                    <Badge className="flex items-center gap-1">
                      <Eye className="h-3 w-3" />
                      <span>Public</span>
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="flex items-center gap-1">
                      <EyeOff className="h-3 w-3" />
                      <span>Private</span>
                    </Badge>
                  )}
                </div>
                <CardDescription>
                  Created {formatDistanceToNow(new Date(template.createdAt), { addSuffix: true })}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-grow">
                <TemplatePreviewGrid
                  templateData={template.templateData}
                  title={template.title}
                  className="h-32 mb-4"
                />
                <p className="text-sm text-muted-foreground line-clamp-2 mb-4">{template.description}</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {template.category && <Badge variant="secondary">{template.category}</Badge>}
                  {template.tags?.split(",").map((tag) => (
                    <Badge key={tag} variant="outline">
                      {tag.trim()}
                    </Badge>
                  ))}
                </div>
              </CardContent>
              <CardFooter className="flex justify-between pt-2">
                <Link href={`/templates/${template.id}`} passHref>
                  <Button variant="outline">View</Button>
                </Link>
                <UserTemplateActions
                  templateId={template.id}
                  downloadCount={template.downloadCount}
                  templateData={template.templateData}
                />
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

