"use client"

import type React from "react"

import { useState } from "react"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Download, Search, Tag, X, Grid } from "lucide-react"
import Link from "next/link"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { TemplatePreviewGrid } from "./template-preview-grid"
import { Pagination } from "./ui/pagination"
import { PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "./ui/pagination"
import type { BingoTemplate } from "@/app/actions/templates"

interface TemplateGalleryProps {
  templates: BingoTemplate[]
  totalTemplates: number
  categories: string[]
  sizes: string[]
  currentSearch: string
  currentCategory: string
  currentSize: string
  currentPage: number
  limit: number
}

export function TemplateGallery({
  templates,
  totalTemplates,
  categories,
  sizes,
  currentSearch,
  currentCategory,
  currentSize,
  currentPage,
  limit,
}: TemplateGalleryProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [searchInput, setSearchInput] = useState(currentSearch)

  const totalPages = Math.ceil(totalTemplates / limit)

  const createQueryString = (params: Record<string, string | null>) => {
    const newParams = new URLSearchParams(searchParams.toString())

    Object.entries(params).forEach(([key, value]) => {
      if (value === null) {
        newParams.delete(key)
      } else {
        newParams.set(key, value)
      }
    })

    return newParams.toString()
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const query = createQueryString({
      search: searchInput || null,
      page: "1", // Reset to first page on new search
    })
    router.push(`${pathname}?${query}`)
  }

  const handleCategoryClick = (category: string) => {
    const isSelected = currentCategory === category
    const query = createQueryString({
      category: isSelected ? null : category,
      page: "1", // Reset to first page on category change
    })
    router.push(`${pathname}?${query}`)
  }

  const handleSizeClick = (size: string) => {
    const isSelected = currentSize === size
    const query = createQueryString({
      size: isSelected ? null : size,
      page: "1", // Reset to first page on size change
    })
    router.push(`${pathname}?${query}`)
  }

  const handleClearFilters = () => {
    setSearchInput("")
    router.push(pathname)
  }

  const hasFilters = currentSearch || currentCategory || currentSize

  return (
    <div>
      <div className="mb-6">
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-grow">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search templates..."
              className="pl-8"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
          <Button type="submit">Search</Button>
          {hasFilters && (
            <Button type="button" variant="ghost" onClick={handleClearFilters}>
              <X className="h-4 w-4 mr-2" />
              Clear
            </Button>
          )}
        </form>
      </div>

      <div className="flex flex-col md:flex-row gap-4 mb-6">
        {categories.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4 md:mb-0">
            <div className="flex items-center mr-2">
              <Tag className="h-4 w-4 mr-1" />
              <span className="text-sm font-medium">Categories:</span>
            </div>
            {categories.map((category) => (
              <Badge
                key={category}
                variant={currentCategory === category ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => handleCategoryClick(category)}
              >
                {category}
              </Badge>
            ))}
          </div>
        )}

        {sizes.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <div className="flex items-center mr-2">
              <Grid className="h-4 w-4 mr-1" />
              <span className="text-sm font-medium">Size:</span>
            </div>
            {sizes.map((size) => (
              <Badge
                key={size}
                variant={currentSize === size ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => handleSizeClick(size)}
              >
                {size}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {hasFilters && (
        <div className="mb-6">
          <p className="text-sm text-muted-foreground">
            Showing {totalTemplates} {totalTemplates === 1 ? "result" : "results"}
            {currentSearch && <span> for &quot;{currentSearch}&quot;</span>}
            {currentCategory && <span> in category &quot;{currentCategory}&quot;</span>}
            {currentSize && <span> with size &quot;{currentSize}&quot;</span>}
          </p>
        </div>
      )}

      {templates.length === 0 ? (
        <div className="text-center py-12 border rounded-lg">
          <h2 className="text-xl font-medium mb-2">No templates found</h2>
          <p className="text-muted-foreground">Try adjusting your search or filters to find what you&apos;re looking for.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {templates.map((template) => (
              <Link key={template.id} href={`/templates/${template.id}`} passHref>
                <Card className="h-full flex flex-col hover:shadow-md transition-shadow cursor-pointer">
                  <CardHeader className="pb-2">
                    <CardTitle className="line-clamp-1">{template.title}</CardTitle>
                    <div className="flex items-center mt-1">
                      <Avatar className="h-5 w-5 mr-2">
                        <AvatarImage src={template.creatorImage ?? undefined} alt={template.creatorName ?? ""} />
                        <AvatarFallback>{template.creatorName?.[0] ?? "U"}</AvatarFallback>
                      </Avatar>
                      <span className="text-xs text-muted-foreground">{template.creatorName}</span>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-grow pb-2">
                    <TemplatePreviewGrid
                      templateData={template.templateData}
                      title={template.title}
                      className="h-48 mb-2"
                    />
                    <p className="text-sm text-muted-foreground line-clamp-2 mt-2">{template.description}</p>
                  </CardContent>
                  <CardFooter className="pt-2">
                    <div className="flex items-center text-sm text-muted-foreground">
                      <Download className="h-3.5 w-3.5 mr-1" />
                      <span>{template.downloadCount} downloads</span>
                    </div>
                  </CardFooter>
                </Card>
              </Link>
            ))}
          </div>

          {totalPages > 1 && (
            <Pagination className="mt-8">
              <PaginationContent>
                {currentPage > 1 && (
                  <PaginationItem>
                    <PaginationPrevious
                      href={`${pathname}?${createQueryString({ page: (currentPage - 1).toString() })}`}
                    />
                  </PaginationItem>
                )}

                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  // Show pages around current page
                  let pageNum = i + 1
                  if (totalPages > 5) {
                    if (currentPage <= 3) {
                      pageNum = i + 1
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i
                    } else {
                      pageNum = currentPage - 2 + i
                    }
                  }

                  return (
                    <PaginationItem key={pageNum}>
                      <PaginationLink
                        href={`${pathname}?${createQueryString({ page: pageNum.toString() })}`}
                        isActive={currentPage === pageNum}
                      >
                        {pageNum}
                      </PaginationLink>
                    </PaginationItem>
                  )
                })}

                {currentPage < totalPages && (
                  <PaginationItem>
                    <PaginationNext href={`${pathname}?${createQueryString({ page: (currentPage + 1).toString() })}`} />
                  </PaginationItem>
                )}
              </PaginationContent>
            </Pagination>
          )}
        </>
      )}
    </div>
  )
}

