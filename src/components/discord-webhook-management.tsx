"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Trash2, TestTube, Plus, MessageSquare } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import {
  createDiscordWebhook,
  updateDiscordWebhook,
  deleteDiscordWebhook,
  getDiscordWebhooks,
} from "@/app/actions/discord-webhooks"
import { testDiscordWebhook } from "@/lib/discord-webhook"

interface DiscordWebhook {
  id: string
  eventId: string
  name: string
  webhookUrl: string
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

interface DiscordWebhookManagementProps {
  eventId: string
}

export function DiscordWebhookManagement({
  eventId,
}: DiscordWebhookManagementProps) {
  const [open, setOpen] = useState(false)
  const [webhooks, setWebhooks] = useState<DiscordWebhook[]>([])
  const [loading, setLoading] = useState(false)
  const [newWebhook, setNewWebhook] = useState({ name: "", webhookUrl: "" })
  const { toast } = useToast()

  const loadWebhooks = useCallback(async () => {
    try {
      const result = await getDiscordWebhooks(eventId)
      if (result) {
        setWebhooks(result)
      }
    } catch (error) {
      console.error("Failed to load Discord webhooks:", error)
      toast({
        title: "Error",
        description: "Failed to load Discord webhooks",
        variant: "destructive",
      })
    }
  }, [eventId, toast])

  useEffect(() => {
    if (open) {
      loadWebhooks()
        .then(() => {
          console.log("Webhooks loaded")
        })
        .catch((error) => {
          console.error("Error loading webhooks:", error)
        })
    }
  }, [open, loadWebhooks])

  const handleCreateWebhook = async () => {
    if (!newWebhook.name.trim() || !newWebhook.webhookUrl.trim()) {
      toast({
        title: "Error",
        description: "Please fill in all fields",
        variant: "destructive",
      })
      return
    }

    setLoading(true)
    try {
      const result = await createDiscordWebhook(
        eventId,
        newWebhook.name,
        newWebhook.webhookUrl
      )

      if (result.success) {
        toast({
          title: "Success",
          description: "Discord webhook created successfully",
        })
        setNewWebhook({ name: "", webhookUrl: "" })
        loadWebhooks()
          .then(() => console.log("Webhooks reloaded after creation"))
          .catch((error) => {
            console.error("Error reloading webhooks:", error)
          })
      } else {
        toast({
          title: "Error",
          description: result.error ?? "Failed to create webhook",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Failed to create Discord webhook:", error)
      toast({
        title: "Error",
        description: "Failed to create Discord webhook",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleToggleWebhook = async (webhookId: string, isActive: boolean) => {
    try {
      const result = await updateDiscordWebhook(webhookId, { isActive })
      if (result.success) {
        toast({
          title: "Success",
          description: `Webhook ${isActive ? "enabled" : "disabled"}`,
        })
        loadWebhooks()
          .then(() => console.log("Webhooks reloaded after toggle"))
          .catch((error) => {
            console.error("Error reloading webhooks:", error)
          })
      } else {
        toast({
          title: "Error",
          description: result.error ?? "Failed to update webhook",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Failed to update webhook:", error)
      toast({
        title: "Error",
        description: "Failed to update webhook",
        variant: "destructive",
      })
    }
  }

  const handleDeleteWebhook = async (webhookId: string) => {
    if (!confirm("Are you sure you want to delete this webhook?")) return

    try {
      const result = await deleteDiscordWebhook(webhookId)
      if (result.success) {
        toast({
          title: "Success",
          description: "Webhook deleted successfully",
        })
        loadWebhooks()
          .then(() => console.log("Webhooks reloaded after deletion"))
          .catch((error) => {
            console.error("Error reloading webhooks:", error)
          })
      } else {
        toast({
          title: "Error",
          description: result.error ?? "Failed to delete webhook",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Failed to delete webhook:", error)
      toast({
        title: "Error",
        description: "Failed to delete webhook",
        variant: "destructive",
      })
    }
  }

  const handleTestWebhook = async (webhookId: string) => {
    try {
      const result = await testDiscordWebhook(webhookId)
      if (!result) {
        toast({
          title: "Success",
          description: "Test message sent successfully!",
        })
      } else {
        toast({
          title: "Error",
          description: "Failed to send test message",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Failed to test webhook:", error)
      toast({
        title: "Error",
        description: "Failed to test webhook",
        variant: "destructive",
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full">
          <MessageSquare className="mr-2 h-4 w-4" />
          Discord Webhooks
        </Button>
      </DialogTrigger>
      <DialogContent
        className="max-h-[80vh] max-w-4xl overflow-y-auto"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Discord Webhook Management</DialogTitle>
          <DialogDescription>
            Manage Discord webhooks for this event. Webhooks will automatically
            post submission notifications.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Add New Webhook */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Add New Webhook
              </CardTitle>
              <CardDescription>
                Create a new Discord webhook to receive submission notifications
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="webhook-name">Webhook Name</Label>
                  <Input
                    id="webhook-name"
                    placeholder="e.g., Main Discord"
                    value={newWebhook.name}
                    onChange={(e) =>
                      setNewWebhook({ ...newWebhook, name: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="webhook-url">Webhook URL</Label>
                  <Input
                    id="webhook-url"
                    type="url"
                    placeholder="https://discord.com/api/webhooks/..."
                    value={newWebhook.webhookUrl}
                    onChange={(e) =>
                      setNewWebhook({
                        ...newWebhook,
                        webhookUrl: e.target.value,
                      })
                    }
                    onPaste={(e) => {
                      // Ensure paste event is handled properly
                      e.stopPropagation()
                    }}
                    autoComplete="off"
                    spellCheck={false}
                  />
                </div>
              </div>
              <Button onClick={handleCreateWebhook} disabled={loading}>
                {loading ? "Creating..." : "Create Webhook"}
              </Button>
            </CardContent>
          </Card>

          {/* Existing Webhooks */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">
              Existing Webhooks ({webhooks.length})
            </h3>
            {webhooks.length === 0 ? (
              <Card>
                <CardContent className="pt-6">
                  <p className="text-center text-muted-foreground">
                    No Discord webhooks configured for this event yet.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {webhooks.map((webhook) => (
                  <Card key={webhook.id}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-base">
                            {webhook.name}
                          </CardTitle>
                          <CardDescription className="font-mono text-xs">
                            {webhook.webhookUrl.substring(0, 50)}...
                          </CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={webhook.isActive ? "default" : "secondary"}
                          >
                            {webhook.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="flex items-center space-x-2">
                            <Switch
                              checked={webhook.isActive}
                              onCheckedChange={(checked) =>
                                handleToggleWebhook(webhook.id, checked)
                              }
                            />
                            <Label>Enable notifications</Label>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              handleTestWebhook(webhook.webhookUrl)
                            }
                          >
                            <TestTube className="mr-1 h-4 w-4" />
                            Test
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteWebhook(webhook.id)}
                          >
                            <Trash2 className="mr-1 h-4 w-4" />
                            Delete
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
