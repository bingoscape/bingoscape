import {
  getPublicTemplates,
  getTemplateCategories,
  getTemplateSizes,
} from "@/app/actions/templates"
import { TemplateGallery } from "@/components/template-gallery"
import { Breadcrumbs } from "@/components/breadcrumbs"
import { Suspense } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { getServerAuthSession } from "@/server/auth"
import { CreateTemplateButton } from "@/components/create-template-button"

export default async function TemplatesPage(props: {
  searchParams: Promise<{
    search?: string
    category?: string
    size?: string
    page?: string
  }>
}) {
  const searchParams = await props.searchParams
  const session = await getServerAuthSession()
  const isAuthenticated = !!session?.user

  const search = searchParams.search ?? ""
  const category = searchParams.category ?? ""
  const size = searchParams.size ?? ""
  const page = Number.parseInt(searchParams.page ?? "1", 10)
  const limit = 12
  const offset = (page - 1) * limit

  const [templatesData, categories, sizes] = await Promise.all([
    getPublicTemplates({ search, category, size, limit, offset }),
    getTemplateCategories(),
    getTemplateSizes(),
  ])

  const breadcrumbItems = [
    { label: "Home", href: "/" },
    { label: "Templates", href: "/templates" },
  ]

  return (
    <div className="container mx-auto py-10">
      <div className="mb-6 flex items-center justify-between">
        <Breadcrumbs items={breadcrumbItems} />
        {isAuthenticated && <CreateTemplateButton />}
      </div>

      <div className="flex flex-col gap-6 md:flex-row">
        <div className="w-full">
          <h1 className="mb-6 text-4xl font-bold">Bingo Board Templates</h1>
          <p className="mb-8 text-lg text-muted-foreground">
            Browse and use community-created bingo board templates for your
            events. Find the perfect template or create your own to share with
            others.
          </p>

          <Suspense fallback={<TemplateGallerySkeleton />}>
            <TemplateGallery
              templates={templatesData.templates}
              totalTemplates={templatesData.total}
              categories={categories}
              sizes={sizes}
              currentSearch={search}
              currentCategory={category}
              currentSize={size}
              currentPage={page}
              limit={limit}
            />
          </Suspense>
        </div>
      </div>
    </div>
  )
}

function TemplateGallerySkeleton() {
  return (
    <div>
      <div className="mb-6 flex gap-4">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-10 w-40" />
      </div>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-[300px] w-full rounded-lg" />
        ))}
      </div>
    </div>
  )
}
