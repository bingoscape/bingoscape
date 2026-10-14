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
import { Badge } from "@/components/ui/badge"
import { formatDistanceToNow } from "date-fns"
import { createApiKey, deleteApiKey, revokeApiKey } from "@/app/actions/api-keys"
import { useFormStatus } from "react-dom"

interface ApiKey {
  id: string
  name: string
  description: string | null
  createdAt: string
  lastUsed: string | null
  /** First characters of the key; keys from before the hashing migration may lack it until first use. */
  keyPrefix: string | null
  scopes: string[]
  expiresAt: string | null
  revokedAt: string | null
  status: "active" | "revoked" | "expired"
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
      // An active key is revoked (it stops working at once and stays in the
      // list); an already revoked or expired one is removed for good.
      const target = initialKeys.find((k) => k.id === keyToDelete)
      const revoking = target?.status === "active"
      const result = revoking
        ? await revokeApiKey(keyToDelete)
        : await deleteApiKey(keyToDelete)
      if (result.success) {
        setIsDeleteDialogOpen(false)
        setKeyToDelete(null)
        toast({
          title: "Success",
          description: revoking
            ? "API key revoked"
            : "API key deleted successfully",
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
                <div className="grid gap-2">
                  <Label htmlFor="expiresInDays">Expires</Label>
                  <select
                    id="expiresInDays"
                    name="expiresInDays"
                    defaultValue=""
                    className="border-input bg-background h-9 rounded-md border px-3 text-sm"
                  >
                    <option value="">Never</option>
                    <option value="30">In 30 days</option>
                    <option value="90">In 90 days</option>
                    <option value="365">In 1 year</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <input id="readOnly" name="readOnly" type="checkbox" />
                  <Label htmlFor="readOnly">
                    Read-only (cannot submit images or drops)
                  </Label>
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
        <Card className="mb-6 border-success bg-success/5">
          <CardHeader>
            <CardTitle className="text-success">API Key Created</CardTitle>
            <CardDescription>
              This is your new API key. Make sure to copy it now as you won&apos;t be able to see it again.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <Input value={newlyCreatedKey} readOnly className="font-mono bg-background" />
              <Button
                size="icon"
                onClick={() => copyToClipboard(newlyCreatedKey)}
                aria-label="Copy API key"
              >
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
                      {key.status !== "active" && (
                        <Badge variant="outline" className="ml-2">
                          {key.status === "revoked" ? "Revoked" : "Expired"}
                        </Badge>
                      )}
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
                        className="text-danger hover:bg-destructive/10"
                        onClick={() => setKeyToDelete(key.id)}
                        aria-label={
                          key.status === "active"
                            ? "Revoke API key"
                            : "Delete API key"
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          {key.status === "active"
                            ? "Revoke API Key"
                            : "Delete API Key"}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          {key.status === "active"
                            ? "Are you sure you want to revoke this API key? Any applications using it will stop working immediately. This cannot be undone."
                            : "Remove this key from the list? This cannot be undone."}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <Button
                          variant="destructive"
                          onClick={handleDeleteKey}
                          disabled={isPendingDelete}
                        >
                          {key.status === "active"
                            ? isPendingDelete
                              ? "Revoking..."
                              : "Revoke"
                            : isPendingDelete
                              ? "Deleting..."
                              : "Delete"}
                        </Button>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-muted-foreground space-y-1">
                  <div className="flex items-center">
                    <span className="font-medium w-24">Key:</span>
                    <span className="font-mono">
                      {key.keyPrefix ? `${key.keyPrefix}...` : "bsn_..."}
                    </span>
                    {!key.scopes.includes("submit") && (
                      <Badge variant="secondary" className="ml-2">
                        Read-only
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center">
                    <span className="font-medium w-24">Created:</span>
                    <span>
                      {formatDistanceToNow(new Date(key.createdAt), {
                        addSuffix: true,
                      })}
                    </span>
                  </div>
                  {key.expiresAt && (
                    <div className="flex items-center">
                      <span className="font-medium w-24">
                        {key.status === "expired" ? "Expired:" : "Expires:"}
                      </span>
                      <span>
                        {formatDistanceToNow(new Date(key.expiresAt), {
                          addSuffix: true,
                        })}
                      </span>
                    </div>
                  )}
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
