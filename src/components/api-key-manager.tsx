"use client"

import { useState, useActionState, useEffect, useTransition } from "react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "@/hooks/use-toast"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Key, Plus, Trash2, Copy } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { createApiKey, deleteApiKey } from "@/app/actions/api-keys"
import { useFormStatus } from "react-dom"

interface ApiKey {
  id: string
  name: string
  description: string | null
  createdAt: string
  lastUsed: string | null
  key?: string // Only present when first created
}

function CreateButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Creating..." : "Create Key"}
    </Button>
  )
}

export function ApiKeyManager({ initialKeys }: { initialKeys: ApiKey[] }) {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<string | null>(null)
  
  const [keyToDelete, setKeyToDelete] = useState<string | null>(null)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isPendingDelete, startDeleteTransition] = useTransition()

  const [createState, createFormAction] = useActionState(createApiKey, null)

  useEffect(() => {
    if (createState?.success && createState.key) {
      const newKey = createState.key.key
      setTimeout(() => {
        setNewlyCreatedKey(newKey || null)
        setIsCreateDialogOpen(false)
        toast({
          title: "Success",
          description: "API key created successfully",
        })
      }, 0)
    } else if (createState?.error) {
      toast({
        title: "Error",
        description: createState.error,
        variant: "destructive",
      })
    }
  }, [createState])

  const handleDeleteKey = () => {
    if (!keyToDelete) return
    startDeleteTransition(async () => {
      const result = await deleteApiKey(keyToDelete)
      if (result.success) {
        setIsDeleteDialogOpen(false)
        setKeyToDelete(null)
        toast({
          title: "Success",
          description: "API key deleted successfully",
        })
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to delete API key",
          variant: "destructive",
        })
      }
    })
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).catch(console.error)
    toast({
      title: "Copied",
      description: "API key copied to clipboard",
    })
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">API Keys</h1>
          <p className="text-muted-foreground mt-2">Manage keys for RuneLite integration.</p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create API Key
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form action={createFormAction}>
              <DialogHeader>
                <DialogTitle>Create New API Key</DialogTitle>
                <DialogDescription>
                  API keys allow RuneLite plugins to access your Bingoscape account. Keep your keys secure.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Key Name</Label>
                  <Input id="name" name="name" placeholder="My RuneLite Plugin" required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="description">Description (Optional)</Label>
                  <Input id="description" name="description" placeholder="Used for my personal RuneLite client" />
                </div>
              </div>
              <DialogFooter>
                <CreateButton />
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {newlyCreatedKey && (
        <Card className="mb-6 border-green-500 bg-green-500/5">
          <CardHeader>
            <CardTitle className="text-green-500">API Key Created</CardTitle>
            <CardDescription>
              This is your new API key. Make sure to copy it now as you won&apos;t be able to see it again.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <Input value={newlyCreatedKey} readOnly className="font-mono bg-background" />
              <Button size="icon" onClick={() => copyToClipboard(newlyCreatedKey)}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
          <CardFooter>
            <Button variant="outline" onClick={() => setNewlyCreatedKey(null)}>
              I&apos;ve Copied My Key
            </Button>
          </CardFooter>
        </Card>
      )}

      <div className="grid gap-6">
        {initialKeys.length === 0 ? (
          <Card className="flex flex-col items-center justify-center py-12 text-center">
            <Key className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
            <CardTitle className="mb-2">No API Keys</CardTitle>
            <CardDescription className="max-w-sm mb-6">
              You haven&apos;t created any API keys yet. Create one to use with the RuneLite plugin.
            </CardDescription>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create API Key
            </Button>
          </Card>
        ) : (
          initialKeys.map((key) => (
            <Card key={key.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="flex items-center text-lg">
                      <Key className="mr-2 h-5 w-5 text-muted-foreground" />
                      {key.name}
                    </CardTitle>
                    {key.description && (
                      <CardDescription className="mt-1">{key.description}</CardDescription>
                    )}
                  </div>
                  <AlertDialog
                    open={isDeleteDialogOpen && keyToDelete === key.id}
                    onOpenChange={(open) => {
                      setIsDeleteDialogOpen(open)
                      if (!open) setKeyToDelete(null)
                    }}
                  >
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:bg-destructive/10"
                        onClick={() => setKeyToDelete(key.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete API Key</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete this API key? This action cannot be undone and any applications using this key will no longer work.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <Button
                          variant="destructive"
                          onClick={handleDeleteKey}
                          disabled={isPendingDelete}
                        >
                          {isPendingDelete ? "Deleting..." : "Delete"}
                        </Button>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-muted-foreground space-y-1">
                  <div className="flex items-center">
                    <span className="font-medium w-24">Created:</span>
                    <span>
                      {formatDistanceToNow(new Date(key.createdAt), {
                        addSuffix: true,
                      })}
                    </span>
                  </div>
                  <div className="flex items-center">
                    <span className="font-medium w-24">Last used:</span>
                    <span>
                      {key.lastUsed 
                        ? formatDistanceToNow(new Date(key.lastUsed), { addSuffix: true }) 
                        : "Never"}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
