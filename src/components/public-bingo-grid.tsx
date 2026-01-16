"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft,
  ChevronRight,
  Users,
  Zap,
  CheckCircle2,
  Clock,
} from "lucide-react";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import getRandomFrog from "@/lib/getRandomFrog";
import type { PublicTeamData } from "@/app/actions/public-events";
import { useSwipeable } from "react-swipeable";
import { useRouter } from "next/navigation";
import Markdown from "react-markdown";
import { CompactGoalTree } from "@/components/compact-goal-tree";
import {
  getGoalTreeWithProgress,
  type GoalTreeNode,
} from "@/app/actions/goal-groups";

interface TeamProgress {
  goalId: string;
  currentValue: number;
  isComplete: boolean;
}

interface TileGoal {
  id: string;
  description: string;
  targetValue: number;
  currentValue?: number;
}

interface Tile {
  id: string;
  title: string;
  description: string | null;
  headerImage: string | null;
  index: number;
  weight: number;
  goals?: TileGoal[];
  isHidden?: boolean;
}

interface Bingo {
  id: string;
  title: string;
  description: string | null;
  rows: number;
  columns: number;
  tiles: Tile[];
}

interface PublicBingoGridProps {
  bingo: Bingo;
  teams: PublicTeamData[];
  // Instead of function props, pass the IDs for navigation
  prevBingoId?: string;
  nextBingoId?: string;
  eventId: string;
}

// Helper function to render status icons
const renderStatusIcon = (status: "completed" | "in_progress" | undefined) => {
  if (status === "completed") {
    return (
      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-green-500 text-white shadow-lg ring-2 ring-green-200 transition-all duration-300 dark:ring-green-800">
        <CheckCircle2 className="h-4 w-4" />
      </div>
    );
  }
  if (status === "in_progress") {
    return (
      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-500 text-white shadow-lg ring-2 ring-amber-200 transition-all duration-300 dark:ring-amber-800">
        <Clock className="h-4 w-4" />
      </div>
    );
  }
  return null;
};

// Individual tile component with hover card
interface PublicBingoTileProps {
  tile: Tile;
  isCompleted: boolean;
  isInProgress: boolean;
  selectedTeamId?: string;
}

function PublicBingoTile({
  tile,
  isCompleted,
  isInProgress,
  selectedTeamId,
}: PublicBingoTileProps) {
  // Goal tree data state for hovercard
  const [goalTreeData, setGoalTreeData] = useState<{
    tree: GoalTreeNode[];
    teamProgress: TeamProgress[];
  } | null>(null);
  const [isLoadingTree, setIsLoadingTree] = useState(false);
  const [isHoverCardOpen, setIsHoverCardOpen] = useState(false);

  // Reset goal tree data when team changes
  useEffect(() => {
    setGoalTreeData(null);
  }, [selectedTeamId]);

  // Load goal tree when hovercard opens
  useEffect(() => {
    if (
      isHoverCardOpen &&
      tile.goals &&
      tile.goals.length > 0 &&
      !goalTreeData &&
      selectedTeamId
    ) {
      const loadTreeData = async () => {
        setIsLoadingTree(true);
        try {
          const data = await getGoalTreeWithProgress(tile.id, selectedTeamId);
          setGoalTreeData(data);
        } catch (error) {
          console.error("Failed to load goal tree:", error);
        } finally {
          setIsLoadingTree(false);
        }
      };
      void loadTreeData();
    }
  }, [isHoverCardOpen, tile.id, tile.goals, selectedTeamId, goalTreeData]);

  // Determine tile status for hover card
  const tileStatus: "completed" | "in_progress" | undefined = isCompleted
    ? "completed"
    : isInProgress
      ? "in_progress"
      : undefined;

  return (
    <div className="relative">
      <HoverCard
        openDelay={200}
        closeDelay={100}
        onOpenChange={setIsHoverCardOpen}
      >
        <HoverCardTrigger asChild>
          <Card
            className={`relative aspect-square cursor-pointer overflow-hidden ${
              isCompleted
                ? "border-2 border-green-500 dark:border-green-400"
                : isInProgress
                  ? "border-2 border-amber-500 dark:border-amber-400"
                  : "border-2 border-primary"
            }`}
          >
            {tile.headerImage ? (
              <div className="relative h-full w-full">
                <Image
                  src={tile.headerImage || getRandomFrog()}
                  alt={tile.title}
                  fill
                  className="object-contain transition-transform duration-300 ease-in-out hover:scale-110"
                />
                {isCompleted && (
                  <div className="absolute inset-0 flex items-center justify-center bg-green-500/20">
                    <div className="rotate-[-20deg] transform rounded-md bg-green-500 px-2 py-1 text-xs font-bold text-white">
                      COMPLETED
                    </div>
                  </div>
                )}
                {isInProgress && !isCompleted && (
                  <div className="absolute inset-0 flex items-center justify-center bg-amber-500/20">
                    <div className="rotate-[-20deg] transform rounded-md bg-amber-500 px-2 py-1 text-xs font-bold text-white">
                      IN PROGRESS
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-primary">
                <span className="text-lg font-semibold text-primary-foreground">
                  {tile.title}
                </span>
                {isCompleted && (
                  <div className="absolute inset-0 flex items-center justify-center bg-green-500/20">
                    <div className="rotate-[-20deg] transform rounded-md bg-green-500 px-2 py-1 text-xs font-bold text-white">
                      COMPLETED
                    </div>
                  </div>
                )}
                {isInProgress && !isCompleted && (
                  <div className="absolute inset-0 flex items-center justify-center bg-amber-500/20">
                    <div className="rotate-[-20deg] transform rounded-md bg-amber-500 px-2 py-1 text-xs font-bold text-white">
                      IN PROGRESS
                    </div>
                  </div>
                )}
              </div>
            )}
          </Card>
        </HoverCardTrigger>
        <HoverCardContent
          side="right"
          align="start"
          className="w-80 max-w-[90vw] p-4"
        >
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-2">
              <h4 className="flex-1 break-words text-base font-semibold leading-tight">
                {tile.title}
              </h4>
              <div className="flex flex-shrink-0 items-center gap-1 rounded-full bg-amber-100 px-2 py-1 dark:bg-amber-900/30">
                <Zap className="h-3.5 w-3.5 text-amber-500" />
                <span className="text-xs font-medium">{tile.weight} XP</span>
              </div>
            </div>

            {tileStatus && (
              <div className="flex items-center gap-2 rounded-lg bg-secondary/30 p-2">
                {renderStatusIcon(tileStatus)}
                <span className="text-sm font-medium capitalize">
                  {tileStatus === "completed" ? "Completed" : "In Progress"}
                </span>
              </div>
            )}

            {tile.description && (
              <div className="prose prose-sm max-w-none text-sm text-muted-foreground dark:prose-invert">
                <Markdown
                  components={{
                    p: ({ children }) => (
                      <p className="mb-2 break-words leading-relaxed last:mb-0">
                        {children}
                      </p>
                    ),
                    strong: ({ children }) => (
                      <strong className="font-semibold text-foreground">
                        {children}
                      </strong>
                    ),
                    em: ({ children }) => (
                      <em className="italic">{children}</em>
                    ),
                    ul: ({ children }) => (
                      <ul className="my-2 list-inside list-disc space-y-1">
                        {children}
                      </ul>
                    ),
                    ol: ({ children }) => (
                      <ol className="my-2 list-inside list-decimal space-y-1">
                        {children}
                      </ol>
                    ),
                    li: ({ children }) => (
                      <li className="break-words text-sm">{children}</li>
                    ),
                    h1: ({ children }) => (
                      <h1 className="mb-1 text-base font-semibold text-foreground">
                        {children}
                      </h1>
                    ),
                    h2: ({ children }) => (
                      <h2 className="mb-1 text-sm font-semibold text-foreground">
                        {children}
                      </h2>
                    ),
                    h3: ({ children }) => (
                      <h3 className="mb-1 text-sm font-medium text-foreground">
                        {children}
                      </h3>
                    ),
                    a: ({ children, href }) => (
                      <a
                        href={href}
                        className="break-all text-primary underline hover:text-primary/80"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {children}
                      </a>
                    ),
                  }}
                >
                  {tile.description.length > 200
                    ? `${tile.description.substring(0, 200)}...`
                    : tile.description}
                </Markdown>
              </div>
            )}

            {tile.goals && tile.goals.length > 0 && selectedTeamId && (
              <div className="pt-1">
                <h5 className="mb-2 text-xs font-semibold">Goals:</h5>
                {isLoadingTree ? (
                  <div className="py-2 text-xs text-muted-foreground">
                    Loading goal tree...
                  </div>
                ) : goalTreeData ? (
                  <CompactGoalTree
                    tree={goalTreeData.tree}
                    teamProgress={goalTreeData.teamProgress}
                    showProgress={true}
                  />
                ) : (
                  <div className="text-xs text-muted-foreground">
                    Hover to load goals
                  </div>
                )}
              </div>
            )}

            {tile.goals && tile.goals.length > 0 && !selectedTeamId && (
              <div className="pt-1">
                <h5 className="mb-2 text-xs font-semibold">Goals:</h5>
                <div className="text-xs text-muted-foreground">
                  {tile.goals.length} goal{tile.goals.length !== 1 ? "s" : ""}{" "}
                  defined
                </div>
              </div>
            )}
          </div>
        </HoverCardContent>
      </HoverCard>
    </div>
  );
}

export function PublicBingoGrid({
  bingo,
  teams,
  prevBingoId,
  nextBingoId,
  eventId,
}: PublicBingoGridProps) {
  const router = useRouter();
  const [selectedTeamId, setSelectedTeamId] = useState<string | undefined>(
    teams.length > 0 ? teams[0]!.id : undefined,
  );
  const [teamIndex, setTeamIndex] = useState(0);

  // Update team index when selectedTeamId changes
  useEffect(() => {
    const index = teams.findIndex((team) => team.id === selectedTeamId);
    if (index !== -1) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Intentional sync of derived state
      setTeamIndex(index);
    }
  }, [selectedTeamId, teams]);

  // Handle team navigation
  const navigateTeam = (direction: "prev" | "next") => {
    const newIndex =
      direction === "prev"
        ? (teamIndex - 1 + teams.length) % teams.length
        : (teamIndex + 1) % teams.length;

    setTeamIndex(newIndex);
    setSelectedTeamId(teams[newIndex]?.id);
  };

  // Handle board navigation
  const navigateBoard = (direction: "prev" | "next") => {
    const targetId = direction === "prev" ? prevBingoId : nextBingoId;
    if (targetId) {
      router.push(`/public/events/${eventId}/bingos/${targetId}`);
    }
  };

  // Set up swipe handlers
  const swipeHandlers = useSwipeable({
    onSwipedLeft: () => teams.length > 1 && navigateTeam("next"),
    onSwipedRight: () => teams.length > 1 && navigateTeam("prev"),
    trackMouse: true,
  });

  const selectedTeam = teams.find((team) => team.id === selectedTeamId);
  const completedTiles = selectedTeam?.completedTiles ?? [];
  const inProgressTiles = selectedTeam?.inProgressTiles ?? [];

  // If no teams, show empty state
  if (teams.length === 0) {
    return (
      <div className="space-y-6">
        <div className="mx-auto aspect-square w-full max-w-[80vh]">
          <div
            className="grid h-full gap-2"
            style={{
              gridTemplateColumns: `repeat(${bingo.columns}, minmax(0, 1fr))`,
              gridTemplateRows: `repeat(${bingo.rows}, minmax(0, 1fr))`,
            }}
          >
            {bingo.tiles.map((tile) => (
              <Card
                key={tile.id}
                className="relative aspect-square overflow-hidden border-2 border-primary"
              >
                {tile.headerImage ? (
                  <Image
                    src={tile.headerImage ?? getRandomFrog()}
                    alt={tile.title}
                    fill
                    className="object-contain transition-transform duration-300 ease-in-out hover:scale-110"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-primary">
                    <span className="text-lg font-semibold text-primary-foreground">
                      {tile.title}
                    </span>
                  </div>
                )}
              </Card>
            ))}
          </div>
        </div>

        {(prevBingoId ?? nextBingoId) && (
          <div className="mt-6 flex justify-between">
            <Button
              variant="outline"
              onClick={() => navigateBoard("prev")}
              disabled={!prevBingoId}
            >
              <ChevronLeft className="mr-2 h-4 w-4" /> Previous Board
            </Button>
            <Button
              variant="outline"
              onClick={() => navigateBoard("next")}
              disabled={!nextBingoId}
            >
              Next Board <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {teams.length > 0 && (
        <div className="flex flex-col items-center gap-4">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-muted-foreground" />
            <span className="font-medium">Team Progress:</span>
          </div>

          <div className="flex w-full items-center justify-center gap-4">
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigateTeam("prev")}
              disabled={teams.length <= 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <div className="min-w-[180px] text-center">
              <h3 className="text-lg font-semibold">{selectedTeam?.name}</h3>
              <div className="flex flex-col items-center gap-1">
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-green-600 dark:text-green-400">
                    {completedTiles.length}
                  </span>{" "}
                  completed,
                  <span className="ml-1 font-medium text-amber-600 dark:text-amber-400">
                    {inProgressTiles.length}
                  </span>{" "}
                  in progress
                </p>
              </div>
            </div>

            <Button
              variant="outline"
              size="icon"
              onClick={() => navigateTeam("next")}
              disabled={teams.length <= 1}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {teams.length > 1 && (
            <div className="mt-2 flex justify-center gap-1">
              {teams.map((team, idx) => (
                <Button
                  key={team.id}
                  variant="ghost"
                  size="sm"
                  className={`h-2 w-2 rounded-full p-0 ${idx === teamIndex ? "bg-primary" : "bg-muted"}`}
                  onClick={() => {
                    setTeamIndex(idx);
                    setSelectedTeamId(team.id);
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      <div
        className="mx-auto aspect-square w-full max-w-[80vh]"
        {...swipeHandlers}
      >
        <div
          className="grid h-full gap-2"
          style={{
            gridTemplateColumns: `repeat(${bingo.columns}, minmax(0, 1fr))`,
            gridTemplateRows: `repeat(${bingo.rows}, minmax(0, 1fr))`,
          }}
        >
          {bingo.tiles.map((tile) => {
            const isCompleted = completedTiles.includes(tile.id);
            const isInProgress = inProgressTiles.includes(tile.id);

            return (
              <PublicBingoTile
                key={tile.id}
                tile={tile}
                isCompleted={isCompleted}
                isInProgress={isInProgress}
                selectedTeamId={selectedTeamId}
              />
            );
          })}
        </div>
      </div>

      {(prevBingoId ?? nextBingoId) && (
        <div className="mt-6 flex justify-between">
          <Button
            variant="outline"
            onClick={() => navigateBoard("prev")}
            disabled={!prevBingoId}
          >
            <ChevronLeft className="mr-2 h-4 w-4" /> Previous Board
          </Button>
          <Button
            variant="outline"
            onClick={() => navigateBoard("next")}
            disabled={!nextBingoId}
          >
            Next Board <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
