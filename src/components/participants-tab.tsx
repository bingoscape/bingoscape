"use client"

import { useState, useMemo } from "react"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { toast } from "@/hooks/use-toast"
import {
  Loader2,
  CheckCircle,
  CircleAlert,
  UserMinus,
  Search,
  Users,
  Crown,
  Shield,
  User,
  MoreHorizontal,
  Edit,
  Trash2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Heart,
} from "lucide-react"
import {
  updateParticipantRole,
  assignParticipantToTeam,
  updateParticipantBuyIn,
  removeParticipantFromEvent,
  getEventParticipants,
} from "@/app/actions/events"
import formatRunescapeGold from "@/lib/formatRunescapeGold"
import type { UUID } from "crypto"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { DonationManagementModal } from "@/components/donation-management-modal"
import { CardHeader, CardTitle } from "@/components/ui/card"
import type { Participant, Team, SortField, SortDirection } from "@/app/events/[id]/participants/types"

interface RemoveParticipantDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => Promise<void>
  participantName: string
}

function RemoveParticipantDialog({ isOpen, onClose, onConfirm, participantName }: RemoveParticipantDialogProps) {
  const [isRemoving, setIsRemoving] = useState(false)

  const handleConfirm = async () => {
    setIsRemoving(true)
    try {
      await onConfirm()
      onClose()
    } catch (error) {
      console.error("Error removing participant:", error)
    } finally {
      setIsRemoving(false)
    }
  }

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove Participant</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to remove {participantName} from this event? This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isRemoving}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault()
              void handleConfirm()
            }}
            disabled={isRemoving}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isRemoving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <UserMinus className="h-4 w-4 mr-2" />}
            Remove
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

interface EditRoleDialogProps {
  isOpen: boolean
  onClose: () => void
  participant: Participant | null
  onRoleChange: (participantId: string, newRole: string) => Promise<void>
  currentUserRole: "admin" | "management" | "participant"
}

function EditRoleDialog({ isOpen, onClose, participant, onRoleChange, currentUserRole }: EditRoleDialogProps) {
  const [selectedRole, setSelectedRole] = useState<string>("")
  const [isUpdating, setIsUpdating] = useState(false)

  useState(() => {
    if (participant) {
      setSelectedRole(participant.role)
    }
  })

  const handleSave = async () => {
    if (!participant || selectedRole === participant.role) {
      onClose()
      return
    }

    setIsUpdating(true)
    try {
      await onRoleChange(participant.id, selectedRole)
      onClose()
    } catch (error) {
      console.error("Error updating role:", error)
    } finally {
      setIsUpdating(false)
    }
  }

  const getAvailableRoles = () => {
    if (currentUserRole === "admin") {
      return [
        { value: "admin", label: "Admin" },
        { value: "management", label: "Management" },
        { value: "participant", label: "Participant" },
      ]
    } else if (currentUserRole === "management") {
      return [
        { value: "management", label: "Management" },
        { value: "participant", label: "Participant" },
      ]
    }
    return []
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Role</DialogTitle>
          <DialogDescription>Change the role for {participant?.runescapeName}</DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <Select value={selectedRole} onValueChange={setSelectedRole}>
            <SelectTrigger>
              <SelectValue placeholder="Select a role" />
            </SelectTrigger>
            <SelectContent>
              {getAvailableRoles().map((role) => (
                <SelectItem key={role.value} value={role.value}>
                  {role.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isUpdating}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isUpdating}>
            {isUpdating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface ChangeTeamDialogProps {
  isOpen: boolean
  onClose: () => void
  participant: Participant | null
  teams: Team[]
  onTeamChange: (participantId: string, teamId: string | null) => Promise<void>
}

function ChangeTeamDialog({ isOpen, onClose, participant, teams, onTeamChange }: ChangeTeamDialogProps) {
  const [selectedTeam, setSelectedTeam] = useState<string>("")
  const [isUpdating, setIsUpdating] = useState(false)

  useState(() => {
    if (participant) {
      setSelectedTeam(participant.teamId ?? "no-team")
    }
  })

  const handleSave = async () => {
    if (!participant) {
      onClose()
      return
    }

    const newTeamId = selectedTeam === "no-team" ? null : selectedTeam
    if (newTeamId === participant.teamId) {
      onClose()
      return
    }

    setIsUpdating(true)
    try {
      await onTeamChange(participant.id, newTeamId)
      onClose()
    } catch (error) {
      console.error("Error updating team:", error)
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change Team</DialogTitle>
          <DialogDescription>Change the team assignment for {participant?.runescapeName}</DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <Select value={selectedTeam} onValueChange={setSelectedTeam}>
            <SelectTrigger>
              <SelectValue placeholder="Select a team" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="no-team">No Team</SelectItem>
              {teams.map((team) => (
                <SelectItem key={team.id} value={team.id}>
                  {team.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isUpdating}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isUpdating}>
            {isUpdating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

const ITEMS_PER_PAGE = 20

interface ParticipantsTabProps {
  eventId: string
  participants: Participant[]
  teams: Team[]
  minimumBuyIn: number
  currentUserRole: "admin" | "management" | "participant"
  isEventCreator: boolean
  onParticipantsChange: (participants: Participant[]) => void
}

export function ParticipantsTab({
  eventId,
  participants: initialParticipants,
  teams,
  minimumBuyIn,
  currentUserRole,
  isEventCreator,
  onParticipantsChange,
}: ParticipantsTabProps) {
  const [participants, setParticipants] = useState<Participant[]>(initialParticipants)
  const [searchTerm, setSearchTerm] = useState("")
  const [roleFilter, setRoleFilter] = useState<string>("all")
  const [teamFilter, setTeamFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false)
  const [editRoleDialogOpen, setEditRoleDialogOpen] = useState(false)
  const [changeTeamDialogOpen, setChangeTeamDialogOpen] = useState(false)
  const [participantToRemove, setParticipantToRemove] = useState<Participant | null>(null)
  const [participantToEdit, setParticipantToEdit] = useState<Participant | null>(null)
  const [selectedParticipants, setSelectedParticipants] = useState<Set<string>>(new Set())
  const [sortField, setSortField] = useState<SortField>("name")
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc")
  const [currentPage, setCurrentPage] = useState(1)
  const [donationModalOpen, setDonationModalOpen] = useState(false)
  const [participantForDonations, setParticipantForDonations] = useState<Participant | null>(null)

  // Sync with parent when participants change
  useState(() => {
    setParticipants(initialParticipants)
  })

  const handleRemoveParticipant = async () => {
    if (!participantToRemove) return

    try {
      await removeParticipantFromEvent(eventId, participantToRemove.id)
      const updatedParticipants = participants.filter((p) => p.id !== participantToRemove.id)
      setParticipants(updatedParticipants)
      onParticipantsChange(updatedParticipants)
      toast({
        title: "Success",
        description: `${participantToRemove.runescapeName} has been removed from the event`,
      })
    } catch (error) {
      console.error("Error removing participant:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to remove participant",
        variant: "destructive",
      })
    }
  }

  const openRemoveDialog = (participant: Participant) => {
    setParticipantToRemove(participant)
    setRemoveDialogOpen(true)
  }

  const openEditRoleDialog = (participant: Participant) => {
    setParticipantToEdit(participant)
    setEditRoleDialogOpen(true)
  }

  const openChangeTeamDialog = (participant: Participant) => {
    setParticipantToEdit(participant)
    setChangeTeamDialogOpen(true)
  }

  const openDonationModal = (participant: Participant) => {
    setParticipantForDonations(participant)
    setDonationModalOpen(true)
  }

  const handleDonationsUpdated = async () => {
    try {
      const participantsData = await getEventParticipants(eventId)
      setParticipants(participantsData)
      onParticipantsChange(participantsData)
    } catch (error) {
      console.error("Error refreshing participants:", error)
    }
  }

  const canManageParticipant = (participant: Participant) => {
    if (isEventCreator) return true
    if (currentUserRole === "participant") return false
    if (currentUserRole === "admin") return true
    if (currentUserRole === "management") {
      return participant.role !== "admin"
    }
    return false
  }

  const canChangeRoles = () => {
    return isEventCreator || currentUserRole === "admin" || currentUserRole === "management"
  }

  const canChangeTeams = () => {
    return isEventCreator || currentUserRole === "admin" || currentUserRole === "management"
  }

  const canRemoveParticipants = () => {
    return isEventCreator || currentUserRole === "admin" || currentUserRole === "management"
  }

  const canEditBuyIns = () => {
    return isEventCreator || currentUserRole === "admin" || currentUserRole === "management"
  }

  const handleRoleChange = async (participantId: string, newRole: string) => {
    try {
      await updateParticipantRole(eventId, participantId, newRole as "admin" | "management" | "participant")
      const updatedParticipants = participants.map((p) =>
        p.id === participantId ? { ...p, role: newRole as "admin" | "management" | "participant" } : p,
      )
      setParticipants(updatedParticipants)
      onParticipantsChange(updatedParticipants)
      toast({
        title: "Success",
        description: "Participant role updated",
      })
    } catch (error) {
      console.error("Error updating role:", error)
      toast({
        title: "Error",
        description: "Failed to update participant role",
        variant: "destructive",
      })
    }
  }

  const handleBuyInChange = async (participantId: string, hasPaid: boolean) => {
    try {
      const result = await updateParticipantBuyIn(eventId, participantId, hasPaid)
      const updatedParticipants = participants.map((p) =>
        p.id === participantId ? { ...p, buyIn: result.buyInAmount || 0 } : p,
      )
      setParticipants(updatedParticipants)
      onParticipantsChange(updatedParticipants)
      toast({
        title: "Success",
        description: hasPaid ? "Buy-in marked as paid" : "Buy-in marked as not paid",
      })
    } catch (error) {
      console.error("Error updating buy-in:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update participant buy-in",
        variant: "destructive",
      })
    }
  }

  const handleTeamAssignment = async (participantId: string, teamId: string | null) => {
    try {
      await assignParticipantToTeam(eventId, participantId, teamId!)
      const updatedParticipants = await getEventParticipants(eventId)
      setParticipants(updatedParticipants)
      onParticipantsChange(updatedParticipants)
      toast({
        title: "Success",
        description: teamId ? "Participant assigned to team" : "Participant removed from team",
      })
    } catch (error) {
      console.error("Error assigning team:", error)
      toast({
        title: "Error",
        description: "Failed to update participant's team",
        variant: "destructive",
      })
    }
  }

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDirection("asc")
    }
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const selectableParticipants = filteredAndSortedParticipants.filter(canManageParticipant)
      setSelectedParticipants(new Set(selectableParticipants.map((p) => p.id)))
    } else {
      setSelectedParticipants(new Set())
    }
  }

  const handleSelectParticipant = (participantId: string, checked: boolean) => {
    const newSelected = new Set(selectedParticipants)
    if (checked) {
      newSelected.add(participantId)
    } else {
      newSelected.delete(participantId)
    }
    setSelectedParticipants(newSelected)
  }

  const handleBulkRemove = async () => {
    if (selectedParticipants.size === 0) return

    try {
      await Promise.all(Array.from(selectedParticipants).map((id) => removeParticipantFromEvent(eventId, id)))
      const updatedParticipants = participants.filter((p) => !selectedParticipants.has(p.id))
      setParticipants(updatedParticipants)
      onParticipantsChange(updatedParticipants)
      setSelectedParticipants(new Set())
      toast({
        title: "Success",
        description: `${selectedParticipants.size} participants removed`,
      })
    } catch {
      toast({
        title: "Error",
        description: "Failed to remove some participants",
        variant: "destructive",
      })
    }
  }

  const filteredAndSortedParticipants = useMemo(() => {
    const filtered = participants.filter((p) => {
      const matchesSearch = p.runescapeName.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesRole = roleFilter === "all" || p.role === roleFilter
      const matchesTeam = teamFilter === "all" || (teamFilter === "no-team" && !p.teamId) || p.teamId === teamFilter
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "verified" && p.buyIn >= minimumBuyIn) ||
        (statusFilter === "unverified" && p.buyIn < minimumBuyIn)

      return matchesSearch && matchesRole && matchesTeam && matchesStatus
    })

    filtered.sort((a, b) => {
      let aValue: string | number
      let bValue: string | number

      switch (sortField) {
        case "name":
          aValue = a.runescapeName.toLowerCase()
          bValue = b.runescapeName.toLowerCase()
          break
        case "role":
          aValue = a.role
          bValue = b.role
          break
        case "team":
          aValue = a.teamName ?? "zzz"
          bValue = b.teamName ?? "zzz"
          break
        case "buyIn":
          aValue = a.buyIn
          bValue = b.buyIn
          break
        case "donations":
          aValue = a.totalDonations
          bValue = b.totalDonations
          break
        case "status":
          aValue = a.buyIn >= minimumBuyIn ? 1 : 0
          bValue = b.buyIn >= minimumBuyIn ? 1 : 0
          break
        default:
          aValue = a.runescapeName.toLowerCase()
          bValue = b.runescapeName.toLowerCase()
      }

      if (sortDirection === "asc") {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0
      }
    })

    return filtered
  }, [participants, searchTerm, roleFilter, teamFilter, statusFilter, minimumBuyIn, sortField, sortDirection])

  const paginatedParticipants = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
    return filteredAndSortedParticipants.slice(startIndex, startIndex + ITEMS_PER_PAGE)
  }, [filteredAndSortedParticipants, currentPage])

  const totalPages = Math.ceil(filteredAndSortedParticipants.length / ITEMS_PER_PAGE)

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "admin":
        return <Crown className="h-4 w-4" />
      case "management":
        return <Shield className="h-4 w-4" />
      default:
        return <User className="h-4 w-4" />
    }
  }

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case "admin":
        return "default"
      case "management":
        return "secondary"
      default:
        return "outline"
    }
  }

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="h-4 w-4" />
    return sortDirection === "asc" ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
  }

  const ParticipantRow = ({ participant, index }: { participant: Participant; index: number }) => {
    const canManage = canManageParticipant(participant)

    return (
      <TableRow
        key={participant.id}
        className={`transition-colors hover:bg-muted/50 ${index % 2 === 0 ? "bg-background" : "bg-muted/20"}`}
      >
        <TableCell className="w-12">
          {canRemoveParticipants() && canManage && (
            <Checkbox
              checked={selectedParticipants.has(participant.id)}
              onCheckedChange={(checked) => handleSelectParticipant(participant.id, checked as boolean)}
            />
          )}
        </TableCell>
        <TableCell className="font-medium">
          <div className="flex items-center gap-2">
            <span>{participant.runescapeName}</span>
          </div>
        </TableCell>
        <TableCell>
          <Badge variant={getRoleBadgeVariant(participant.role)} className="flex items-center gap-1 w-fit">
            {getRoleIcon(participant.role)}
            {participant.role}
          </Badge>
        </TableCell>
        <TableCell>
          {participant.teamName ? (
            <Badge variant="outline" className="flex items-center gap-1 w-fit">
              <Users className="h-3 w-3" />
              {participant.teamName}
            </Badge>
          ) : (
            <span className="text-muted-foreground text-sm">No Team</span>
          )}
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-3">
            {canEditBuyIns() ? (
              <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
                <Checkbox
                  checked={participant.buyIn >= minimumBuyIn}
                  onCheckedChange={(checked) => handleBuyInChange(participant.id, checked as boolean)}
                  className="data-[state=checked]:bg-green-500 data-[state=checked]:border-green-500 h-5 w-5"
                />
                <span className="text-sm font-medium">{participant.buyIn >= minimumBuyIn ? "Paid" : "Unpaid"}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="font-medium">{formatRunescapeGold(participant.buyIn)} GP</span>
                {participant.buyIn >= minimumBuyIn ? (
                  <Badge variant="default" className="bg-green-500 text-white">
                    Paid
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-orange-600 border-orange-600">
                    Unpaid
                  </Badge>
                )}
              </div>
            )}
          </div>
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-2">
            <span className="font-medium text-green-600 dark:text-green-400">
              {formatRunescapeGold(participant.totalDonations)} GP
            </span>
            {canEditBuyIns() && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => openDonationModal(participant)}
                className="h-7 w-7 p-0 text-green-600 hover:bg-green-50 hover:text-green-700 dark:hover:bg-green-950"
              >
                <Heart className="h-4 w-4" />
              </Button>
            )}
          </div>
        </TableCell>
        <TableCell>
          <div className="flex justify-center">
            {participant.buyIn >= minimumBuyIn ? (
              <Badge variant="default" className="bg-green-500 text-white border-0">
                <CheckCircle className="h-3 w-3 mr-1" />
                Verified
              </Badge>
            ) : (
              <Badge variant="outline" className="text-orange-600 border-orange-600">
                <CircleAlert className="h-3 w-3 mr-1" />
                Pending
              </Badge>
            )}
          </div>
        </TableCell>
        <TableCell>
          {canManage && (canChangeRoles() || canChangeTeams() || canRemoveParticipants()) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {canChangeRoles() && (
                  <DropdownMenuItem onClick={() => openEditRoleDialog(participant)}>
                    <Edit className="h-4 w-4 mr-2" />
                    Edit Role
                  </DropdownMenuItem>
                )}
                {canChangeTeams() && (
                  <DropdownMenuItem onClick={() => openChangeTeamDialog(participant)}>
                    <Users className="h-4 w-4 mr-2" />
                    Change Team
                  </DropdownMenuItem>
                )}
                {(canChangeRoles() || canChangeTeams()) && canRemoveParticipants() && <DropdownMenuSeparator />}
                {canRemoveParticipants() && (
                  <DropdownMenuItem onClick={() => openRemoveDialog(participant)} className="text-destructive">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Remove
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </TableCell>
      </TableRow>
    )
  }

  const MobileParticipantCard = ({ participant }: { participant: Participant }) => {
    const canManage = canManageParticipant(participant)

    return (
      <Card key={participant.id} className="mb-4">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">{participant.runescapeName}</CardTitle>
            {canManage && (canChangeRoles() || canChangeTeams() || canRemoveParticipants()) && (
              <div className="flex items-center gap-2">
                {canRemoveParticipants() && (
                  <Checkbox
                    checked={selectedParticipants.has(participant.id)}
                    onCheckedChange={(checked) => handleSelectParticipant(participant.id, checked as boolean)}
                  />
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {canChangeRoles() && (
                      <DropdownMenuItem onClick={() => openEditRoleDialog(participant)}>
                        <Edit className="h-4 w-4 mr-2" />
                        Edit Role
                      </DropdownMenuItem>
                    )}
                    {canChangeTeams() && (
                      <DropdownMenuItem onClick={() => openChangeTeamDialog(participant)}>
                        <Users className="h-4 w-4 mr-2" />
                        Change Team
                      </DropdownMenuItem>
                    )}
                    {(canChangeRoles() || canChangeTeams()) && canRemoveParticipants() && <DropdownMenuSeparator />}
                    {canRemoveParticipants() && (
                      <DropdownMenuItem onClick={() => openRemoveDialog(participant)} className="text-destructive">
                        <Trash2 className="h-4 w-4 mr-2" />
                        Remove
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Role:</span>
            <Badge variant={getRoleBadgeVariant(participant.role)} className="flex items-center gap-1">
              {getRoleIcon(participant.role)}
              {participant.role}
            </Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Team:</span>
            {participant.teamName ? (
              <Badge variant="outline" className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {participant.teamName}
              </Badge>
            ) : (
              <span className="text-muted-foreground text-sm">No Team</span>
            )}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Buy-in:</span>
            <div className="flex items-center gap-2">
              {canEditBuyIns() ? (
                <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
                  <Checkbox
                    checked={participant.buyIn >= minimumBuyIn}
                    onCheckedChange={(checked) => handleBuyInChange(participant.id, checked as boolean)}
                    className="data-[state=checked]:bg-green-500 data-[state=checked]:border-green-500 h-4 w-4"
                  />
                  <span className="text-sm font-medium">{participant.buyIn >= minimumBuyIn ? "Paid" : "Unpaid"}</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="font-medium">{formatRunescapeGold(participant.buyIn)} GP</span>
                  {participant.buyIn >= minimumBuyIn ? (
                    <Badge variant="default" className="bg-green-500 text-white text-xs">
                      Paid
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-orange-600 border-orange-600 text-xs">
                      Unpaid
                    </Badge>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Donations:</span>
            <div className="flex items-center gap-2">
              <span className="font-medium text-green-600 dark:text-green-400">
                {formatRunescapeGold(participant.totalDonations)} GP
              </span>
              {canEditBuyIns() && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => openDonationModal(participant)}
                  className="h-6 w-6 p-0 text-green-600 hover:bg-green-50 hover:text-green-700 dark:hover:bg-green-950"
                >
                  <Heart className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  const selectableParticipants = filteredAndSortedParticipants.filter(canManageParticipant)
  const allSelectableSelected =
    selectableParticipants.length > 0 && selectableParticipants.every((p) => selectedParticipants.has(p.id))

  return (
    <div className="flex flex-col gap-6">
      {/* Bulk actions bar */}
      {canRemoveParticipants() && selectedParticipants.size > 0 && (
        <div className="flex items-center justify-end gap-2">
          <span className="text-sm text-muted-foreground">{selectedParticipants.size} selected</span>
          <Button variant="destructive" size="sm" onClick={handleBulkRemove}>
            <Trash2 className="h-4 w-4 mr-2" />
            Remove Selected
          </Button>
        </div>
      )}

      {/* Filters and Search */}
      <Card>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search participants..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="management">Management</SelectItem>
                <SelectItem value="participant">Participant</SelectItem>
              </SelectContent>
            </Select>

            <Select value={teamFilter} onValueChange={setTeamFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by team" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Teams</SelectItem>
                <SelectItem value="no-team">No Team</SelectItem>
                {teams.map((team) => (
                  <SelectItem key={team.id} value={team.id}>
                    {team.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="verified">Verified</SelectItem>
                <SelectItem value="unverified">Unverified</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Desktop Table View */}
      <div className="hidden md:block">
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    {canRemoveParticipants() && selectableParticipants.length > 0 && (
                      <Checkbox checked={allSelectableSelected} onCheckedChange={handleSelectAll} />
                    )}
                  </TableHead>
                  <TableHead>
                    <Button
                      variant="ghost"
                      onClick={() => handleSort("name")}
                      className="flex items-center gap-2 p-0 h-auto font-medium"
                    >
                      Name
                      {getSortIcon("name")}
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button
                      variant="ghost"
                      onClick={() => handleSort("role")}
                      className="flex items-center gap-2 p-0 h-auto font-medium"
                    >
                      Role
                      {getSortIcon("role")}
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button
                      variant="ghost"
                      onClick={() => handleSort("team")}
                      className="flex items-center gap-2 p-0 h-auto font-medium"
                    >
                      Team
                      {getSortIcon("team")}
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button
                      variant="ghost"
                      onClick={() => handleSort("buyIn")}
                      className="flex items-center gap-2 p-0 h-auto font-medium"
                    >
                      Buy-In
                      {getSortIcon("buyIn")}
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button
                      variant="ghost"
                      onClick={() => handleSort("donations")}
                      className="flex items-center gap-2 p-0 h-auto font-medium"
                    >
                      Donations
                      {getSortIcon("donations")}
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button
                      variant="ghost"
                      onClick={() => handleSort("status")}
                      className="flex items-center gap-2 p-0 h-auto font-medium"
                    >
                      Status
                      {getSortIcon("status")}
                    </Button>
                  </TableHead>
                  <TableHead className="w-20">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedParticipants.map((participant, index) => (
                  <ParticipantRow key={participant.id} participant={participant} index={index} />
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden">
        {paginatedParticipants.map((participant) => (
          <MobileParticipantCard key={participant.id} participant={participant} />
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to{" "}
            {Math.min(currentPage * ITEMS_PER_PAGE, filteredAndSortedParticipants.length)} of{" "}
            {filteredAndSortedParticipants.length} participants
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(currentPage - 1)}
              disabled={currentPage === 1}
            >
              Previous
            </Button>
            <span className="text-sm">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Dialogs */}
      {participantToRemove && (
        <RemoveParticipantDialog
          isOpen={removeDialogOpen}
          onClose={() => setRemoveDialogOpen(false)}
          onConfirm={handleRemoveParticipant}
          participantName={participantToRemove.runescapeName}
        />
      )}

      <EditRoleDialog
        isOpen={editRoleDialogOpen}
        onClose={() => setEditRoleDialogOpen(false)}
        participant={participantToEdit}
        onRoleChange={handleRoleChange}
        currentUserRole={currentUserRole}
      />

      <ChangeTeamDialog
        isOpen={changeTeamDialogOpen}
        onClose={() => setChangeTeamDialogOpen(false)}
        participant={participantToEdit}
        teams={teams}
        onTeamChange={handleTeamAssignment}
      />

      {participantForDonations && (
        <DonationManagementModal
          isOpen={donationModalOpen}
          onClose={() => {
            setDonationModalOpen(false)
            setParticipantForDonations(null)
          }}
          eventId={eventId}
          participantId={participantForDonations.id}
          participantName={participantForDonations.runescapeName}
          onDonationsUpdated={handleDonationsUpdated}
        />
      )}
    </div>
  )
}
