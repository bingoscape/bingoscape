'use client'

import { useState } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "@/hooks/use-toast"
import { type GenerateInviteResponse } from '@/app/api/clans/[clanId]/invite/route'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Link } from "lucide-react"

interface InviteFormData {
  label: string
  expiresInDays: string // "0" = permanent, "1", "7", "30", "custom"
  customDays: string
  maxUses: string // "0" = unlimited, "1", "10", "custom"
  customMaxUses: string
}

export function GenerateClanInviteLink({ clanId }: { clanId: string }) {
  const [inviteLink, setInviteLink] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [formData, setFormData] = useState<InviteFormData>({
    label: '',
    expiresInDays: '0', // Default to permanent
    customDays: '',
    maxUses: '0', // Default to unlimited
    customMaxUses: '',
  })

  const generateInvite = async () => {
    setIsLoading(true)
    try {
      // Calculate actual values
      let expiresInDays: number | null = null
      if (formData.expiresInDays === 'custom') {
        expiresInDays = parseInt(formData.customDays) || null
      } else if (formData.expiresInDays !== '0') {
        expiresInDays = parseInt(formData.expiresInDays)
      }

      let maxUses: number | null = null
      if (formData.maxUses === 'custom') {
        maxUses = parseInt(formData.customMaxUses) || null
      } else if (formData.maxUses !== '0') {
        maxUses = parseInt(formData.maxUses)
      }

      const response = await fetch(`/api/clans/${clanId}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: formData.label || undefined,
          expiresInDays,
          maxUses,
        }),
      })

      const data = await response.json() as GenerateInviteResponse | { error: string }

      if (response.ok && 'inviteCode' in data) {
        const link = `${window.location.origin}/clans/join?code=${data.inviteCode}`
        setInviteLink(link)
        toast({
          title: "Invite link generated",
          description: "The invite link has been created successfully.",
        })
      } else {
        throw new Error('error' in data ? data.error : "Failed to generate invite")
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to generate invite link",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(inviteLink)
    toast({
      title: "Copied to clipboard",
      description: "The invite link has been copied to your clipboard.",
    })
  }

  const resetForm = () => {
    setFormData({
      label: '',
      expiresInDays: '0',
      customDays: '',
      maxUses: '0',
      customMaxUses: '',
    })
    setInviteLink('')
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      setIsOpen(open)
      if (!open) resetForm()
    }}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Link className="mr-2 h-4 w-4" />
          Generate Invite Link
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Generate Clan Invite Link</DialogTitle>
          <DialogDescription>
            Create a customizable invite link for this clan. Configure expiration and usage limits.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {/* Label Input */}
          <div className="space-y-2">
            <Label htmlFor="label">Label (Optional)</Label>
            <Input
              id="label"
              placeholder="e.g., Discord Recruitment, Friends"
              value={formData.label}
              onChange={(e) => setFormData({ ...formData, label: e.target.value })}
              maxLength={100}
            />
          </div>

          {/* Expiration Select */}
          <div className="space-y-2">
            <Label htmlFor="expiration">Expiration</Label>
            <Select
              value={formData.expiresInDays}
              onValueChange={(value) => setFormData({ ...formData, expiresInDays: value })}
            >
              <SelectTrigger id="expiration">
                <SelectValue placeholder="Select expiration" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Never (Permanent)</SelectItem>
                <SelectItem value="1">1 Day</SelectItem>
                <SelectItem value="7">7 Days</SelectItem>
                <SelectItem value="30">30 Days</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Custom Days Input */}
          {formData.expiresInDays === 'custom' && (
            <div className="space-y-2">
              <Label htmlFor="customDays">Custom Days</Label>
              <Input
                id="customDays"
                type="number"
                min="1"
                max="365"
                placeholder="Enter days (1-365)"
                value={formData.customDays}
                onChange={(e) => setFormData({ ...formData, customDays: e.target.value })}
              />
            </div>
          )}

          {/* Max Uses Select */}
          <div className="space-y-2">
            <Label htmlFor="maxUses">Usage Limit</Label>
            <Select
              value={formData.maxUses}
              onValueChange={(value) => setFormData({ ...formData, maxUses: value })}
            >
              <SelectTrigger id="maxUses">
                <SelectValue placeholder="Select usage limit" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Unlimited</SelectItem>
                <SelectItem value="1">Single Use</SelectItem>
                <SelectItem value="10">10 Uses</SelectItem>
                <SelectItem value="25">25 Uses</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Custom Max Uses Input */}
          {formData.maxUses === 'custom' && (
            <div className="space-y-2">
              <Label htmlFor="customMaxUses">Custom Usage Limit</Label>
              <Input
                id="customMaxUses"
                type="number"
                min="1"
                max="10000"
                placeholder="Enter max uses (1-10000)"
                value={formData.customMaxUses}
                onChange={(e) => setFormData({ ...formData, customMaxUses: e.target.value })}
              />
            </div>
          )}

          {/* Generate Button */}
          <Button onClick={generateInvite} disabled={isLoading} className="w-full">
            {isLoading ? "Generating..." : "Generate Invite Link"}
          </Button>

          {/* Generated Link Display */}
          {inviteLink && (
            <div className="space-y-2">
              <Label>Generated Link</Label>
              <div className="flex space-x-2">
                <Input value={inviteLink} readOnly />
                <Button onClick={copyToClipboard}>Copy</Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
