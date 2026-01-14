"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Upload, Loader2, CheckCircle2, Users } from "lucide-react";
import type { SelectableUser } from "@/app/actions/bingo";

interface SubmissionUploadFormProps {
  teamName: string;
  selectedImage: File | null;
  pastedImage: File | null;
  isUploading: boolean;
  onImageChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onSubmit: () => void;
  showTeamHeader?: boolean;
  disabled?: boolean;
  // New props for submitting on behalf of another user
  selectableUsers?: SelectableUser[];
  selectedUserId?: string;
  onUserSelect?: (userId: string) => void;
}

export function SubmissionUploadForm({
  teamName,
  selectedImage,
  pastedImage,
  isUploading,
  onImageChange,
  onSubmit,
  showTeamHeader = true,
  disabled = false,
  selectableUsers,
  selectedUserId,
  onUserSelect,
}: SubmissionUploadFormProps) {
  // Group users by team for management users (when there are multiple teams)
  const groupedUsers = selectableUsers?.reduce(
    (groups, user) => {
      const teamKey = user.teamName ?? "Unassigned";
      if (!groups[teamKey]) {
        groups[teamKey] = [];
      }
      groups[teamKey].push(user);
      return groups;
    },
    {} as Record<string, SelectableUser[]>,
  );

  const hasMultipleTeams = groupedUsers
    ? Object.keys(groupedUsers).length > 1
    : false;
  const showUserSelection =
    selectableUsers && selectableUsers.length > 1 && onUserSelect;

  return (
    <div className="space-y-4">
      {showTeamHeader && (
        <div className="flex items-center gap-2">
          <div
            className="h-3 w-3 rounded-full"
            style={{
              backgroundColor: `hsl(${((teamName?.charCodeAt(0) ?? 0) * 10) % 360}, 70%, 50%)`,
            }}
          />
          <h3 className="text-lg font-semibold">Submit for {teamName}</h3>
        </div>
      )}

      {/* User selection dropdown for submitting on behalf of another user */}
      {showUserSelection && (
        <div className="space-y-2">
          <Label className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Users className="h-4 w-4" />
            Submit on behalf of
          </Label>
          <Select value={selectedUserId} onValueChange={onUserSelect}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select user..." />
            </SelectTrigger>
            <SelectContent>
              {hasMultipleTeams && groupedUsers
                ? // Group by team when there are multiple teams (management view)
                  Object.entries(groupedUsers).map(
                    ([teamNameGroup, usersInTeam]) => (
                      <SelectGroup key={teamNameGroup}>
                        <SelectLabel className="flex items-center gap-2">
                          <div
                            className="h-2 w-2 rounded-full"
                            style={{
                              backgroundColor:
                                teamNameGroup !== "Unassigned"
                                  ? `hsl(${(teamNameGroup.charCodeAt(0) * 10) % 360}, 70%, 50%)`
                                  : "#888",
                            }}
                          />
                          {teamNameGroup}
                        </SelectLabel>
                        {usersInTeam.map((user) => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.runescapeName ?? user.name ?? "Unknown User"}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ),
                  )
                : // Flat list for team members only (participant view)
                  selectableUsers.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.runescapeName ?? user.name ?? "Unknown User"}
                    </SelectItem>
                  ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div>
        <Label
          htmlFor="image"
          className="mb-2 block text-sm font-medium text-muted-foreground"
        >
          Upload Image
        </Label>

        {/* Enhanced drag-and-drop upload area */}
        <div className="relative">
          <div
            className={`rounded-lg border-2 border-dashed p-8 text-center transition-all duration-200 ${
              disabled
                ? "scale-[0.98] border-gray-200 bg-gray-50/50"
                : "scale-100 border-border bg-muted/20 shadow-sm hover:border-muted-foreground hover:bg-muted/30"
            }`}
          >
            <div className="flex flex-col items-center space-y-4">
              <div
                className={`rounded-full p-4 transition-colors ${
                  disabled ? "bg-gray-200" : "bg-blue-500/20"
                }`}
              >
                <Upload
                  className={`h-8 w-8 transition-colors ${
                    disabled ? "text-gray-400" : "text-blue-500"
                  }`}
                />
              </div>
              <div className="space-y-2">
                <p
                  className={`text-sm font-medium ${
                    disabled ? "text-gray-500" : "text-foreground"
                  }`}
                >
                  {disabled
                    ? "Select a tile first"
                    : "Drag and drop your image here, or click to browse"}
                </p>
                <p
                  className={`text-xs ${
                    disabled ? "text-gray-400" : "text-muted-foreground"
                  }`}
                >
                  {!disabled && "PNG, JPG, GIF up to 10MB"}
                  {disabled && (
                    <span className="flex items-center justify-center gap-1">
                      <svg
                        className="h-3 w-3"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M7 11l5-5m0 0l5 5m-5-5v12"
                        />
                      </svg>
                      Choose a tile above to upload images
                    </span>
                  )}
                </p>
              </div>
              <Input
                id="image"
                type="file"
                accept="image/*"
                onChange={onImageChange}
                disabled={isUploading || disabled}
                className={`absolute inset-0 h-full w-full cursor-pointer opacity-0 ${(selectedImage ?? pastedImage ?? (isUploading || disabled)) ? "pointer-events-none" : ""}`}
              />
            </div>
          </div>

          {/* Image preview */}
          {(selectedImage ?? pastedImage) && (
            <div
              className={`mt-4 rounded-lg border p-4 ${isUploading ? "border-blue-500 bg-blue-500/20" : "border-green-500 bg-green-500/20"}`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`rounded-full p-2 ${isUploading ? "bg-blue-500/30" : "bg-green-500/30"}`}
                >
                  {isUploading ? (
                    <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                  ) : (
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  )}
                </div>
                <div className="flex-1">
                  <p
                    className={`text-sm font-medium ${isUploading ? "text-blue-500" : "text-green-500"}`}
                  >
                    {isUploading
                      ? "Uploading image..."
                      : "Image ready to submit"}
                  </p>
                  <p
                    className={`text-xs ${isUploading ? "text-blue-500/80" : "text-green-500/80"}`}
                  >
                    {selectedImage ? selectedImage.name : "Pasted image"}
                  </p>
                </div>
                <Button
                  onClick={onSubmit}
                  disabled={isUploading}
                  className="bg-green-500 text-white hover:bg-green-600 disabled:cursor-not-allowed disabled:opacity-50"
                  size="sm"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      Submit
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <kbd className="rounded bg-muted px-2 py-1 text-xs">Ctrl</kbd>
            <span>+</span>
            <kbd className="rounded bg-muted px-2 py-1 text-xs">V</kbd>
          </div>
          <span>to paste an image directly</span>
        </div>
      </div>
    </div>
  );
}
