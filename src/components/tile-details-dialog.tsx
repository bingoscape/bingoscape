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
import type { Tile, Team, EventRole, Goal } from "@/app/actions/events"
import type { SelectableUser } from "@/app/actions/bingo"

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
    newStatus: "approved" | "needs_review"
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
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="modal-content flex h-[90vh] w-[95vw] max-w-[1400px] flex-col overflow-hidden border-border bg-background">
        <DialogHeader className="border-b border-border pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <DialogTitle className="text-2xl font-bold text-foreground">
                {selectedTile?.title}
              </DialogTitle>
              <div className="flex items-center gap-2 rounded-full border border-yellow-500/30 bg-gradient-to-r from-yellow-500/20 to-yellow-600/20 px-3 py-1.5">
                <Zap className="h-4 w-4 text-yellow-500" />
                <span className="font-semibold text-yellow-500">
                  {selectedTile?.weight} XP
                </span>
              </div>
            </div>
          </div>
          <DialogDescription className="mt-2 text-sm text-muted-foreground">
            Manage tile details, goals, and submissions for your bingo event
          </DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="details" className="flex flex-1 flex-col">
          <TabsList className="mb-4 grid h-14 w-full grid-cols-3 rounded-lg border border-border bg-muted/50 p-1">
            <TabsTrigger
              value="details"
              className="rounded-md font-medium text-muted-foreground transition-all duration-200 hover:text-foreground data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
            >
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-blue-500"></div>
                <span>Tile Details</span>
              </div>
            </TabsTrigger>
            <TabsTrigger
              value="goals"
              className="rounded-md font-medium text-muted-foreground transition-all duration-200 hover:text-foreground data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
            >
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-green-500"></div>
                <span>Goals</span>
              </div>
            </TabsTrigger>
            <TabsTrigger
              value="submissions"
              className="rounded-md font-medium text-muted-foreground transition-all duration-200 hover:text-foreground data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
            >
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-purple-500"></div>
                <span>Submissions</span>
              </div>
            </TabsTrigger>
          </TabsList>
          <TabsContent
            value="details"
            className="tab-content flex-1 space-y-6 overflow-y-auto"
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
            className="tab-content flex-1 space-y-6 overflow-y-auto"
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
            className="tab-content flex-1 space-y-6 overflow-y-auto"
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
