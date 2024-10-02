'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createBingo } from '@/app/actions/bingo'
import { ForwardRefEditor } from './forward-ref-editor'
import '@mdxeditor/editor/style.css'

export function CreateBingoModal({ eventId }: { eventId: string }) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [description, setDescription] = useState('')
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    formData.append('eventId', eventId)
    formData.append('description', description)

    try {
      await createBingo(formData)
      setOpen(false)
      router.refresh()
    } catch (error) {
      if (error instanceof Error) {
        setError(error.message)
      } else {
        setError('An unknown error occurred')
      }
    }
  }

  const handleEditorChange = (content: string) => {
    setDescription(content)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Create New Bingo</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[700px]">
        <DialogHeader>
          <DialogTitle>Create New Bingo</DialogTitle>
          <DialogDescription>Set up the basic structure for your new bingo game. Tiles will be automatically created.</DialogDescription>
        </DialogHeader>
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
            <strong className="font-bold">Error: </strong>
            <span className="block sm:inline">{error}</span>
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="title">Title</Label>
            <Input id="title" name="title" required />
          </div>
          <div>
            <Label htmlFor="codephrase">Codephrase</Label>
            <Input id="codephrase" name="codephrase" required />
          </div>
          <div>
            <Label htmlFor="bingoDescription">Description</Label>
            <div className="h-[200px] overflow-y-auto border rounded-md">
              <ForwardRefEditor
                onChange={handleEditorChange}
                markdown={description}
                contentEditableClassName="prose max-w-full"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="rows">Number of Rows</Label>
              <Input id="rows" name="rows" type="number" min="1" max="10" required />
            </div>
            <div>
              <Label htmlFor="columns">Number of Columns</Label>
              <Input id="columns" name="columns" type="number" min="1" max="10" required />
            </div>
          </div>

          <Button type="submit">Create Bingo</Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
