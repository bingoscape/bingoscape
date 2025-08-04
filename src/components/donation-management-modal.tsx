"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { toast } from "@/hooks/use-toast"
import {
  addParticipantDonation,
  updateParticipantDonation,
  removeParticipantDonation,
  getParticipantDonations,
} from "@/app/actions/events"
import formatRunescapeGold from "@/lib/formatRunescapeGold"
import {
  Loader2,
  Plus,
  Edit,
  Trash2,
  DollarSign,
  Check,
  X,
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

interface Donation {
  id: string
  amount: number
  description?: string
  createdAt: Date
  updatedAt: Date
}

interface DonationManagementModalProps {
  isOpen: boolean
  onClose: () => void
  eventId: string
  participantId: string
  participantName: string
  onDonationsUpdated: () => void
}

export function DonationManagementModal({
  isOpen,
  onClose,
  eventId,
  participantId,
  participantName,
  onDonationsUpdated,
}: DonationManagementModalProps) {
  const [donations, setDonations] = useState<Donation[]>([])
  const [loading, setLoading] = useState(false)
  const [isAddingDonation, setIsAddingDonation] = useState(false)
  const [editingDonation, setEditingDonation] = useState<Donation | null>(null)
  const [newDonation, setNewDonation] = useState({
    amount: "",
    description: "",
  })

  useEffect(() => {
    if (isOpen) {
      fetchDonations()
    }
  }, [isOpen, eventId, participantId])

  const fetchDonations = async () => {
    setLoading(true)
    try {
      const donationsData = await getParticipantDonations(eventId, participantId)
      setDonations(donationsData)
    } catch (error) {
      console.error("Error fetching donations:", error)
      toast({
        title: "Error",
        description: "Failed to load donations",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleAddDonation = async () => {
    if (!newDonation.amount || Number(newDonation.amount) <= 0) {
      toast({
        title: "Error",
        description: "Please enter a valid donation amount",
        variant: "destructive",
      })
      return
    }

    try {
      await addParticipantDonation(
        eventId,
        participantId,
        Number(newDonation.amount),
        newDonation.description || undefined
      )
      
      setNewDonation({ amount: "", description: "" })
      setIsAddingDonation(false)
      await fetchDonations()
      onDonationsUpdated()
      
      toast({
        title: "Success",
        description: "Donation added successfully",
      })
    } catch (error) {
      console.error("Error adding donation:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add donation",
        variant: "destructive",
      })
    }
  }

  const handleUpdateDonation = async (donation: Donation, amount: number, description?: string) => {
    try {
      await updateParticipantDonation(eventId, donation.id, amount, description)
      
      setEditingDonation(null)
      await fetchDonations()
      onDonationsUpdated()
      
      toast({
        title: "Success",
        description: "Donation updated successfully",
      })
    } catch (error) {
      console.error("Error updating donation:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update donation",
        variant: "destructive",
      })
    }
  }

  const handleRemoveDonation = async (donationId: string) => {
    if (!confirm("Are you sure you want to remove this donation?")) {
      return
    }

    try {
      await removeParticipantDonation(eventId, donationId)
      
      await fetchDonations()
      onDonationsUpdated()
      
      toast({
        title: "Success",
        description: "Donation removed successfully",
      })
    } catch (error) {
      console.error("Error removing donation:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to remove donation",
        variant: "destructive",
      })
    }
  }

  const totalDonations = donations.reduce((sum, donation) => sum + donation.amount, 0)

  const EditableDonationRow = ({ donation }: { donation: Donation }) => {
    const [editAmount, setEditAmount] = useState(donation.amount.toString())
    const [editDescription, setEditDescription] = useState(donation.description || "")
    const [isUpdating, setIsUpdating] = useState(false)

    const handleSave = async () => {
      if (!editAmount || Number(editAmount) <= 0) {
        toast({
          title: "Error",
          description: "Please enter a valid amount",
          variant: "destructive",
        })
        return
      }

      setIsUpdating(true)
      try {
        await handleUpdateDonation(donation, Number(editAmount), editDescription || undefined)
      } finally {
        setIsUpdating(false)
      }
    }

    const handleCancel = () => {
      setEditAmount(donation.amount.toString())
      setEditDescription(donation.description || "")
      setEditingDonation(null)
    }

    return (
      <TableRow>
        <TableCell>
          <Input
            type="number"
            value={editAmount}
            onChange={(e) => setEditAmount(e.target.value)}
            min="0"
            className="w-32"
          />
        </TableCell>
        <TableCell>
          <Input
            value={editDescription}
            onChange={(e) => setEditDescription(e.target.value)}
            placeholder="Optional description"
            className="w-full"
          />
        </TableCell>
        <TableCell>
          <Badge variant="outline">
            {new Date(donation.createdAt).toLocaleDateString()}
          </Badge>
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={handleSave}
              disabled={isUpdating}
            >
              {isUpdating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleCancel}
              disabled={isUpdating}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </TableCell>
      </TableRow>
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Manage Donations - {participantName}
          </DialogTitle>
          <DialogDescription>
            Track and manage donations for this participant
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Summary Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Donation Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-green-600">
                    {formatRunescapeGold(totalDonations)} GP
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Total from {donations.length} donation{donations.length !== 1 ? 's' : ''}
                  </div>
                </div>
                <Button
                  onClick={() => setIsAddingDonation(true)}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Donation
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Add New Donation Form */}
          {isAddingDonation && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Add New Donation</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Amount (GP)</label>
                    <Input
                      type="number"
                      value={newDonation.amount}
                      onChange={(e) => setNewDonation(prev => ({ ...prev, amount: e.target.value }))}
                      placeholder="Enter amount"
                      min="0"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Description (Optional)</label>
                    <Input
                      value={newDonation.description}
                      onChange={(e) => setNewDonation(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Optional description"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsAddingDonation(false)
                      setNewDonation({ amount: "", description: "" })
                    }}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleAddDonation}>
                    Add Donation
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Donations Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Donation History</CardTitle>
              <CardDescription>
                All donations for this participant
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center items-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : donations.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No donations found for this participant
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Amount</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Date Added</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {donations.map((donation) => 
                      editingDonation?.id === donation.id ? (
                        <EditableDonationRow key={donation.id} donation={donation} />
                      ) : (
                        <TableRow key={donation.id}>
                          <TableCell className="font-medium">
                            {formatRunescapeGold(donation.amount)} GP
                          </TableCell>
                          <TableCell>
                            {donation.description || (
                              <span className="text-muted-foreground italic">No description</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {new Date(donation.createdAt).toLocaleDateString()}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setEditingDonation(donation)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleRemoveDonation(donation.id)}
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}