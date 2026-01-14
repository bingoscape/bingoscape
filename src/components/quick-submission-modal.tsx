"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Tile, Team, Bingo } from "@/app/actions/events";
import type { SelectableUser } from "@/app/actions/bingo";
import { TileSelectionDropdown } from "@/components/tile-selection-dropdown";
import { SubmissionUploadForm } from "@/components/submission-upload-form";
import { toast } from "@/hooks/use-toast";

interface QuickSubmissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  bingo: Bingo;
  currentTeamId: string;
  currentTeam: Team | undefined;
  unlockedTiers?: Set<number>;
  onSubmissionComplete?: () => void;
  eventId: string;
}

export function QuickSubmissionModal({
  isOpen,
  onClose,
  bingo,
  currentTeamId,
  currentTeam,
  unlockedTiers,
  onSubmissionComplete,
  eventId,
}: QuickSubmissionModalProps) {
  const [selectedTile, setSelectedTile] = useState<Tile | null>(null);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [pastedImage, setPastedImage] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // State for submitting on behalf of another user
  const [selectableUsers, setSelectableUsers] = useState<SelectableUser[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | undefined>(
    undefined,
  );
  const { data: session } = useSession();

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedTile(null);
      setSelectedImage(null);
      setPastedImage(null);
      setIsUploading(false);
      setSelectableUsers([]);
      setSelectedUserId(undefined);
    }
  }, [isOpen]);

  // Fetch selectable users when modal opens
  useEffect(() => {
    if (isOpen && currentTeamId && eventId) {
      const fetchUsers = async () => {
        try {
          const { getSelectableUsersForSubmission } = await import(
            "@/app/actions/bingo"
          );
          const users = await getSelectableUsersForSubmission(
            eventId,
            currentTeamId,
          );
          setSelectableUsers(users);
          // Default to first user (which is the current user)
          if (users.length > 0) {
            setSelectedUserId(users[0]!.id);
          }
        } catch (error) {
          console.error("Failed to fetch selectable users:", error);
        }
      };
      void fetchUsers();
    }
  }, [isOpen, currentTeamId, eventId]);

  // Helper function to get target user's team ID
  const getTargetUserTeamId = useCallback(
    (userId: string): string => {
      if (!userId || userId === session?.user?.id) {
        return currentTeamId;
      }

      const targetUser = selectableUsers.find((u) => u.id === userId);
      return targetUser?.teamId ?? currentTeamId;
    },
    [currentTeamId, selectableUsers, session?.user?.id],
  );

  // Handle tile selection
  const handleTileSelect = (tile: Tile) => {
    setSelectedTile(tile);
  };

  // Handle user selection
  const handleUserSelect = (userId: string) => {
    setSelectedUserId(userId);
    // Clear selected tile when user changes to force re-evaluation
    setSelectedTile(null);
  };

  // Handle image change
  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      setPastedImage(null);
    }
  };

  // Handle image submit
  const handleImageSubmit = async () => {
    if (!selectedTile || (!selectedImage && !pastedImage)) return;

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append("tileId", selectedTile.id);
      formData.append("teamId", currentTeamId);
      formData.append("image", selectedImage ?? pastedImage!);

      // Include onBehalfOfUserId if a different user is selected
      if (selectedUserId) {
        formData.append("onBehalfOfUserId", selectedUserId);
      }

      const { submitImage } = await import("@/app/actions/bingo");
      await submitImage(formData);

      // Find the selected user's name for the toast message
      const targetUser = selectableUsers.find((u) => u.id === selectedUserId);
      const targetUserName =
        targetUser?.runescapeName ?? targetUser?.name ?? "the user";

      // Success! Show toast
      toast({
        title: "Submission successful",
        description: `Image has been submitted for "${selectedTile.title}" on behalf of ${targetUserName}`,
        duration: 3000,
      });

      // Close modal and trigger refresh
      onClose();
      onSubmissionComplete?.();
    } catch (error) {
      console.error("Failed to submit image:", error);
      toast({
        title: "Submission failed",
        description:
          "There was an error submitting your image. Please try again.",
        variant: "destructive",
        duration: 5000,
      });
    } finally {
      setIsUploading(false);
    }
  };

  // Handle paste event for images
  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      if (!isOpen || !selectedTile) return;

      const items = event.clipboardData?.items;
      if (!items) return;

      for (const item of items) {
        if (item.type.includes("image")) {
          const file = item.getAsFile();
          if (file) {
            setPastedImage(file);
            setSelectedImage(null);
            event.preventDefault();
          }
        }
      }
    };

    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [isOpen, selectedTile]);

  const showUserSelection = (() => {
    const assignedUsers = selectableUsers.filter(
      (user) => user.teamName !== undefined && user.teamName !== null,
    );
    return assignedUsers.length > 1;
  })();

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[80vh] sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Quick Submit</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* User Selection Section */}
          {showUserSelection && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">
                Submit on behalf of
              </label>
              <Select value={selectedUserId} onValueChange={handleUserSelect}>
                <SelectTrigger>
                  <SelectValue placeholder="Select user..." />
                </SelectTrigger>
                <SelectContent>
                  {(() => {
                    // Filter out unassigned users
                    const assignedUsers = selectableUsers.filter(
                      (user) =>
                        user.teamName !== undefined && user.teamName !== null,
                    );

                    const groupedUsers = assignedUsers.reduce(
                      (groups, user) => {
                        const teamKey = user.teamName!;
                        if (!groups[teamKey]) {
                          groups[teamKey] = [];
                        }
                        groups[teamKey].push(user);
                        return groups;
                      },
                      {} as Record<string, typeof assignedUsers>,
                    );

                    const hasMultipleTeams =
                      Object.keys(groupedUsers).length > 1;

                    return hasMultipleTeams
                      ? Object.entries(groupedUsers).map(
                          ([teamNameGroup, usersInTeam]) => (
                            <SelectGroup key={teamNameGroup}>
                              <SelectLabel>{teamNameGroup}</SelectLabel>
                              {usersInTeam.map((user) => (
                                <SelectItem key={user.id} value={user.id}>
                                  {user.runescapeName ??
                                    user.name ??
                                    "Unknown User"}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          ),
                        )
                      : assignedUsers.map((user) => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.runescapeName ?? user.name ?? "Unknown User"}
                          </SelectItem>
                        ));
                  })()}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Tile Selection Section */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">
              Select a tile to submit to
            </label>
            <TileSelectionDropdown
              tiles={bingo.tiles ?? []}
              currentTeamId={currentTeamId}
              targetTeamId={getTargetUserTeamId(selectedUserId ?? "")}
              onTileSelect={handleTileSelect}
              unlockedTiers={unlockedTiers}
            />
          </div>

          {/* Selected Tile Info */}
          {selectedTile && (
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="text-sm font-medium">{selectedTile.title}</p>
              {selectedTile.description && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {selectedTile.description}
                </p>
              )}
            </div>
          )}

          {/* Upload Section */}
          <SubmissionUploadForm
            teamName={currentTeam?.name ?? "Your Team"}
            selectedImage={selectedImage}
            pastedImage={pastedImage}
            isUploading={isUploading}
            onImageChange={handleImageChange}
            onSubmit={handleImageSubmit}
            showTeamHeader={false}
            disabled={!selectedTile}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
