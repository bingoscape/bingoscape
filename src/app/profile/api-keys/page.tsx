/* eslint-disable */
"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
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
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Key, Plus, Trash2, Copy, Clock } from "lucide-react"
import { formatDistanceToNow } from "date-fns"

interface ApiKey {
  id: string
  name: string
  description: string | null
  createdAt: string
  lastUsed: string | null
  key?: string // Only present when first created
}

export default function ApiKeysPage() {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(true)
  const [newKeyName, setNewKeyName] = useState("")
  const [newKeyDescription, setNewKeyDescription] = useState("")
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isCreatingKey, setIsCreatingKey] = useState(false)
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<string | null>(null)
  const [keyToDelete, setKeyToDelete] = useState<string | null>(null)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isDeletingKey, setIsDeletingKey] = useState(false)

  useEffect(() => {
    fetchApiKeys().then(() => console.log("fetched keys")).catch((err) => console.error(err))
  }, [])

  const fetchApiKeys = async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/runelite/keys")
      if (!response.ok) {
        throw new Error("Failed to fetch API keys")
      }
      const data = await response.json()

      setApiKeys(data)
    } catch (error) {
      console.error("Error fetching API keys:", error)
      toast({
        title: "Error",
        description: "Failed to load API keys",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleCreateKey = async () => {
    if (!newKeyName.trim()) {
      toast({
        title: "Error",
        description: "Key name is required",
        variant: "destructive",
      })
      return
    }

    setIsCreatingKey(true)
    try {
      const response = await fetch("/api/runelite/keys", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: newKeyName,
          description: newKeyDescription || undefined,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to create API key")
      }

      const newKey = await response.json()
      setApiKeys([...apiKeys, newKey])
      setNewlyCreatedKey(newKey.key)
      setNewKeyName("")
      setNewKeyDescription("")
      toast({
        title: "Success",
        description: "API key created successfully",
      })
    } catch (error) {
      console.error("Error creating API key:", error)
      toast({
        title: "Error",
        description: "Failed to create API key",
        variant: "destructive",
      })
    } finally {
      setIsCreatingKey(false)
    }
  }

  const handleDeleteKey = async () => {
    if (!keyToDelete) return

    setIsDeletingKey(true)
    try {
      const response = await fetch(`/api/runelite/keys/${keyToDelete}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        throw new Error("Failed to delete API key")
      }

      setApiKeys(apiKeys.filter((key) => key.id !== keyToDelete))
      setIsDeleteDialogOpen(false)
      toast({
        title: "Success",
        description: "API key deleted successfully",
      })
    } catch (error) {
      console.error("Error deleting API key:", error)
      toast({
        title: "Error",
        description: "Failed to delete API key",
        variant: "destructive",
      })
    } finally {
      setIsDeletingKey(false)
      setKeyToDelete(null)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => console.log("Copied to clipboard")).catch(err => console.error(err))
    toast({
      title: "Copied",
      description: "API key copied to clipboard",
    })
  }

  return (
    <div className="container mx-auto py-10">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">API Keys</h1>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create API Key
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New API Key</DialogTitle>
              <DialogDescription>
                API keys allow RuneLite plugins to access your Bingoscape account. Keep your keys secure.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Key Name</Label>
                <Input
                  id="name"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  placeholder="My RuneLite Plugin"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="description">Description (Optional)</Label>
                <Input
                  id="description"
                  value={newKeyDescription}
                  onChange={(e) => setNewKeyDescription(e.target.value)}
                  placeholder="Used for my personal RuneLite client"
                />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleCreateKey} disabled={isCreatingKey}>
                {isCreatingKey ? "Creating..." : "Create Key"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {newlyCreatedKey && (
        <Card className="mb-6 border-green-500">
          <CardHeader>
            <CardTitle className="text-green-500">API Key Created</CardTitle>
            <CardDescription>
              This is your new API key. Make sure to copy it now as you won&apos;t be able to see it again.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <Input value={newlyCreatedKey} readOnly className="font-mono" />
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
        {loading ? (
          <div className="text-center py-10">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4">Loading API keys...</p>
          </div>
        ) : apiKeys.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>No API Keys</CardTitle>
              <CardDescription>
                You haven&apos;t created any API keys yet. Create one to use with the RuneLite plugin.
              </CardDescription>
            </CardHeader>
            <CardFooter>
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Create API Key
              </Button>
            </CardFooter>
          </Card>
        ) : (
          apiKeys.map((key) => (
            <Card key={key.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="flex items-center">
                      <Key className="mr-2 h-5 w-5" />
                      {key.name}
                    </CardTitle>
                    {key.description && <CardDescription>{key.description}</CardDescription>}
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
                        className="text-destructive"
                        onClick={() => setKeyToDelete(key.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete API Key</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete this API key? This action cannot be undone and any
                          applications using this key will no longer work.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleDeleteKey}
                          disabled={isDeletingKey}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          {isDeletingKey ? "Deleting..." : "Delete"}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-muted-foreground">
                  <div className="flex items-center mb-1">
                    <span className="font-medium mr-2">Created:</span>
                    <span>{formatDistanceToNow(new Date(key.createdAt), { addSuffix: true })}</span>
                  </div>
                  {key.lastUsed && (
                    <div className="flex items-center">
                      <Clock className="mr-2 h-4 w-4" />
                      <span className="font-medium mr-2">Last used:</span>
                      <span>{formatDistanceToNow(new Date(key.lastUsed), { addSuffix: true })}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}

