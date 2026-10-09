import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Zap } from "lucide-react"
import { TileDetailsTab } from "./tile-details-tab"
import { GoalsTab } from "./goals-tab"
import { SubmissionsTab } from "./submissions-tab"
import { EventRole } from "@/app/actions/events"
import type { Tile, Team, Goal, SelectableUser, Submission } from "@/types/model"



interface TileDetailsDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  selectedTile: Tile | null
  editedTile: Partial<Tile>
  userRole: EventRole
  teams: Team[]
  eventId: string
  gameType: "osrs" | "rs3"
  isProgressionBingo: boolean
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onEditTile: (field: string, value: any) => void
  onUpdateTile: () => void
  onEditorChange: (content: string) => void
  onUpdateProgress: (goalId: string, teamId: string, newValue: number) => void
  newGoal: Partial<Goal>
  hasSufficientRights: boolean
  onDeleteGoal: (goalId: string) => void
  onAddGoal: () => void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onNewGoalChange: (field: string, value: any) => void
  currentTeamId: string | undefined
  selectedImage: File | null
  pastedImage: File | null
  isSubmissionsLocked: boolean
  isUploadingImage: boolean
  onImageChange: (event: React.ChangeEvent<HTMLInputElement>) => void
  onImageSubmit: (onBehalfOfUserId?: string) => void
  onFullSizeImageView: (src: string, alt: string) => void
  onTeamTileSubmissionStatusUpdate: (
    teamTileSubmissionId: string | undefined,
    newStatus: "completed" | "needs_attention"
  ) => void
  onSubmissionStatusUpdate: (
    submissionId: string,
    newStatus: "pending" | "approved" | "needs_review",
    goalId?: string | null,
    submissionValue?: number | null
  ) => void
  onDeleteSubmission: (submissionId: string) => void
  selectableUsers: SelectableUser[]
  selectedUserId: string | undefined
  onUserSelect: (userId: string | undefined) => void
}

export function TileDetailsDialog({
  isOpen,
  onOpenChange,
  selectedTile,
  editedTile,
  userRole,
  teams,
  eventId,
  gameType,
  isProgressionBingo,
  onEditTile,
  onUpdateTile,
  onEditorChange,
  onUpdateProgress,
  newGoal,
  hasSufficientRights,
  onDeleteGoal,
  onAddGoal,
  onNewGoalChange,
  currentTeamId,
  selectedImage,
  pastedImage,
  isSubmissionsLocked,
  isUploadingImage,
  onImageChange,
  onImageSubmit,
  onFullSizeImageView,
  onTeamTileSubmissionStatusUpdate,
  onSubmissionStatusUpdate,
  onDeleteSubmission,
  selectableUsers,
  selectedUserId,
  onUserSelect,
}: TileDetailsDialogProps) {

  // Calculate pending submissions for the badge
  const pendingCount = selectedTile?.teamTileSubmissions?.reduce((acc, teamSub) => {
    // If not admin, only count for their team
    if (!hasSufficientRights && teamSub.teamId !== currentTeamId) return acc
    
    // Count pending and needs_review
    const count = teamSub.submissions.filter((sub: Submission) => sub.status === "pending" || sub.status === "needs_review").length
    return acc + count
  }, 0) || 0

  const currentTeamSubmission = currentTeamId 
    ? selectedTile?.teamTileSubmissions?.find((sub) => sub.teamId === currentTeamId)
    : null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="modal-content flex h-[90vh] w-[95vw] max-w-[1400px] flex-col overflow-hidden border-border">
        <DialogHeader className="border-b border-border pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <DialogTitle className="osrs-heading text-2xl font-bold text-foreground">
                {selectedTile?.title}
              </DialogTitle>
              <div className="flex items-center gap-2 osrs-panel-inset rounded-sm px-3 py-1.5">
                <Zap className="h-4 w-4 text-warning" />
                <span className="font-semibold text-warning">
                  {selectedTile?.weight} XP
                </span>
              </div>
              {currentTeamSubmission && (
                <div className={`osrs-panel-inset flex items-center gap-2 rounded-sm px-3 py-1.5 text-sm font-medium ${
                  currentTeamSubmission.status === 'completed' 
                    ? 'text-success' 
                    : currentTeamSubmission.status === 'needs_attention'
                      ? 'text-warning'
                      : 'text-pending'
                }`}>
                  {currentTeamSubmission.status === 'completed' ? 'Completed' : 
                   currentTeamSubmission.status === 'needs_attention' ? 'Needs Attention' : 'In Progress'}
                </div>
              )}
            </div>
          </div>
          <DialogDescription className="mt-2 text-sm text-muted-foreground">
            Manage tile details, goals, and submissions for your bingo event
          </DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="details" className="flex flex-1 flex-col min-h-0">
          <TabsList className="mb-4 grid h-14 w-full shrink-0 grid-cols-3">
            <TabsTrigger
              value="details"
              className="font-medium"
            >
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-sm bg-pending"></div>
                <span>Tile Details</span>
              </div>
            </TabsTrigger>
            <TabsTrigger
              value="goals"
              className="font-medium"
            >
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-sm bg-success"></div>
                <span>Goals</span>
              </div>
            </TabsTrigger>
            <TabsTrigger
              value="submissions"
              className="font-medium"
            >
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-sm bg-info"></div>
                <span>Submissions</span>
                {pendingCount > 0 && (
                  <span className="flex h-5 w-5 items-center justify-center rounded-sm bg-info/15 text-xs font-medium text-info">
                    {pendingCount}
                  </span>
                )}
              </div>
            </TabsTrigger>
          </TabsList>
          <TabsContent
            value="details"
            className="tab-content flex-1 min-h-0 space-y-6 overflow-y-auto px-1"
          >
            <TileDetailsTab
              selectedTile={selectedTile}
              editedTile={editedTile}
              userRole={userRole}
              teams={teams}
              eventId={eventId}
              gameType={gameType}
              isProgressionBingo={isProgressionBingo}
              onEditTile={onEditTile}
              onUpdateTile={onUpdateTile}
              onEditorChange={onEditorChange}
              onUpdateProgress={onUpdateProgress}
            />
          </TabsContent>
          <TabsContent
            value="goals"
            className="tab-content flex-1 min-h-0 space-y-6 overflow-y-auto px-1"
          >
            <GoalsTab
              selectedTile={selectedTile}
              newGoal={newGoal}
              hasSufficientRights={hasSufficientRights}
              onDeleteGoal={onDeleteGoal}
              onAddGoal={onAddGoal}
              onNewGoalChange={onNewGoalChange}
            />
          </TabsContent>
          <TabsContent
            value="submissions"
            className="tab-content flex-1 min-h-0 space-y-6 overflow-y-auto px-1"
          >
            <SubmissionsTab
              teamTileSubmissions={selectedTile?.teamTileSubmissions || []}
              selectedTile={selectedTile}
              currentTeamId={currentTeamId}
              teams={teams}
              hasSufficientRights={hasSufficientRights}
              selectedImage={selectedImage}
              pastedImage={pastedImage}
              isSubmissionsLocked={isSubmissionsLocked}
              isUploadingImage={isUploadingImage}
              onImageChange={onImageChange}
              onImageSubmit={onImageSubmit}
              onFullSizeImageView={onFullSizeImageView}
              onTeamTileSubmissionStatusUpdate={
                onTeamTileSubmissionStatusUpdate
              }
              onSubmissionStatusUpdate={onSubmissionStatusUpdate}
              onDeleteSubmission={onDeleteSubmission}
              selectableUsers={selectableUsers}
              selectedUserId={selectedUserId}
              onUserSelect={onUserSelect}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
