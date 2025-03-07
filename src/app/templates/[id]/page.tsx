/* eslint-disable */
import { getTemplateById } from "@/app/actions/templates"
import { notFound } from "next/navigation"
import { Breadcrumbs } from "@/components/breadcrumbs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Download, Calendar, Tag, Grid } from "lucide-react"
import { TemplatePreviewGrid } from "@/components/template-preview-grid"
import { ImportTemplateButton } from "@/components/import-template-button"
import { formatDistanceToNow } from "date-fns"
import { getServerAuthSession } from "@/server/auth"
import { ExportedBingo } from "@/app/actions/bingo-import-export"

export default async function TemplatePage({ params }: { params: { id: string } }) {
  const template = await getTemplateById(params.id)
  const session = await getServerAuthSession()

  if (!template) {
    notFound()
  }

  const breadcrumbItems = [
    { label: "Home", href: "/" },
    { label: "Templates", href: "/templates" },
    { label: template.title, href: `/templates/${template.id}` },
  ]

  const tags = template.tags?.split(",").map((tag) => tag.trim()) ?? []
  const createdAt = formatDistanceToNow(new Date(template.createdAt), { addSuffix: true })

  // Try to parse the template data to extract grid size
  let gridSize = ""
  try {
    const parsedData: ExportedBingo = JSON.parse(template.templateData)
    if (parsedData?.metadata?.rows && parsedData?.metadata?.columns) {
      gridSize = `${parsedData.metadata.rows}×${parsedData.metadata.columns}`
    }
  } catch (error) {
    console.error("Error parsing template data:", error)
  }

  return (
    <div className="container mx-auto py-10">
      <Breadcrumbs items={breadcrumbItems} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-6">
        <div className="lg:col-span-2">
          <Card className="mb-6">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-2xl">{template.title}</CardTitle>
                  <CardDescription>
                    <div className="flex items-center mt-2">
                      <Avatar className="h-6 w-6 mr-2">
                        <AvatarImage src={template.creatorImage ?? undefined} alt={template.creatorName ?? ""} />
                        <AvatarFallback>{template.creatorName?.[0] ?? "U"}</AvatarFallback>
                      </Avatar>
                      <span className="text-sm">Created by {template.creatorName}</span>
                    </div>
                  </CardDescription>
                </div>
                {session?.user && <ImportTemplateButton templateId={template.id} />}
              </div>
            </CardHeader>
            <CardContent>
              <div className="prose max-w-none dark:prose-invert mb-6">
                <p>{template.description}</p>
              </div>

              <div className="mt-6">
                <TemplatePreviewGrid templateData={template.templateData} title={template.title} isDetailView={true} />
              </div>
            </CardContent>
          </Card>
        </div>

        <div>
          <Card>
            <CardHeader>
              <CardTitle>Template Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center">
                <Download className="h-4 w-4 mr-2 text-muted-foreground" />
                <span>{template.downloadCount} downloads</span>
              </div>

              <div className="flex items-center">
                <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
                <span>Created {createdAt}</span>
              </div>

              {gridSize && (
                <div className="flex items-center">
                  <Grid className="h-4 w-4 mr-2 text-muted-foreground" />
                  <span>Size: {gridSize} grid</span>
                </div>
              )}

              {template.category && (
                <div>
                  <h4 className="text-sm font-medium mb-2 flex items-center">
                    <Tag className="h-4 w-4 mr-2 text-muted-foreground" />
                    Category
                  </h4>
                  <Badge variant="secondary">{template.category}</Badge>
                </div>
              )}

              {tags.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2">Tags</h4>
                  <div className="flex flex-wrap gap-2">
                    {tags.map((tag) => (
                      <Badge key={tag} variant="outline">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

