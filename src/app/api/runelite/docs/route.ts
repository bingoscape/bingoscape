import { NextResponse } from "next/server"

// API documentation for the RuneLite plugin
export async function GET() {
  const apiDocs = {
    version: "3.0.0",
    baseUrl: "/api/runelite",
    description: "API for the BingoScape RuneLite plugin",
    changelog: {
      "3.0.0":
        "Breaking. Removed POST /items/check: no client used it, and it raised goal progress from an item list the caller typed, without a screenshot or review.",
      "2.1.0":
        "Additive. Board payloads carry apiVersion '2.1', tiles[].tierLocked and tiles[].isBlind, progression.tiers[] and a battleship block. /events lists all board types. GET /bingos/{bingoId} serves battleship boards, requires event access, supports ETag/If-None-Match and is rate limited to 60 requests/minute per user. Submission responses carry tierUnlocked and shot. New error codes TIER_LOCKED, BOARD_BLIND and EVENT_NOT_STARTED.",
      "2.0.0":
        "Added hierarchical goal tree structure with goal groups, item goals, and goal values. Maintained backwards compatibility with flat goals array.",
      "1.0.0":
        "Initial API release with basic bingo, tile, and submission endpoints",
    },
    authentication: {
      type: "Bearer Token",
      description:
        "All endpoints require an API key to be passed in the Authorization header as a Bearer token",
      example: "Authorization: Bearer bsn_your_api_key_here",
    },
    endpoints: [
      {
        path: "/auth",
        method: "POST",
        description: "Verify an API key and get user information",
        request: {
          body: {
            apiKey: "string",
          },
        },
        response: {
          valid: "boolean",
          user: {
            id: "string",
            name: "string",
            runescapeName: "string",
            image: "string",
          },
        },
      },
      {
        path: "/events",
        method: "GET",
        description:
          "Get all events for the authenticated user. Every bingo of every bingoType (standard, progression, battleship) is returned as a full board payload (see dataStructures.boardPayload) for the user's team. Hidden bingos are excluded, even for managers. Events without a visible bingo are omitted.",
        response: [
          {
            id: "string",
            title: "string",
            description: "string",
            startDate: "date",
            endDate: "date",
            locked: "boolean",
            public: "boolean",
            userTeam: {
              name: "string",
              members: [{ isLeader: "boolean", runescapeName: "string" }],
            },
            role: "string",
            bingos: ["boardPayload (see dataStructures.boardPayload)"],
          },
        ],
      },
      {
        path: "/bingos/{bingoId}",
        method: "GET",
        description:
          "Get one board as seen by the authenticated user's team. Only event participants and managers can read a board, and only managers can read a hidden one. Rate limited to 60 requests/minute per user (in-memory per server process; 304 answers count). Poll with If-None-Match and stay under the limit.",
        request: {
          headers: {
            "If-None-Match":
              "string (optional) - A previous ETag. Answers 304 with no body when the board is unchanged. Lists, weak tags and * are accepted.",
          },
        },
        response: "boardPayload (see dataStructures.boardPayload)",
        responseHeaders: {
          ETag: "string - Hash of the body excluding battleship.serverNow. Differs per view (team and role). Sent on 200 and 304.",
          "Cache-Control": "private, no-cache - Sent on 200 and 304",
        },
        errors: {
          "401": { error: "Invalid API key" },
          "404": {
            error: "Bingo not found",
            note: "Unknown id, not a participant of the event, or a hidden bingo seen by a non-manager. These cases are deliberately indistinguishable.",
          },
          "304": "No body. If-None-Match matched the current ETag",
          "429": {
            error: "Too many requests",
            note: "See the Retry-After header (seconds)",
          },
        },
      },
      {
        path: "/events/{eventId}/bingos",
        method: "GET",
        description: "Get all bingos for a specific event",
        response: [
          {
            id: "string",
            title: "string",
            description: "string",
            rows: "number",
            columns: "number",
            visible: "boolean",
          },
        ],
      },
      {
        path: "/bingos/{bingoId}/tiles",
        method: "GET",
        description: "Get all tiles for a specific bingo",
        response: [
          {
            id: "string",
            title: "string",
            description: "string",
            headerImage: "string",
            weight: "number",
            index: "number",
            isHidden: "boolean",
          },
        ],
      },
      {
        path: "/tiles/{tileId}/submissions",
        method: "GET",
        description: "Get submissions for a specific tile",
        response: {
          teamId: "string",
          teamName: "string",
          status: "string",
          submissions: [
            {
              id: "string",
              createdAt: "date",
              image: {
                path: "string",
              },
            },
          ],
        },
      },
      {
        path: "/tiles/{tileId}/submissions",
        method: "POST",
        description: "Submit an image for a specific tile",
        request: {
          formData: {
            image: "file",
          },
        },
        response:
          "boardPayload (see dataStructures.boardPayload) plus tierUnlocked and shot. Both are always null on this route: a plain submission never completes a tile.",
        errors: {
          "401": { error: "Invalid API key" },
          "403": {
            codes: ["TIER_LOCKED", "EVENT_NOT_STARTED"],
            note: "See dataStructures.errorCodes",
          },
          "404": { error: "Tile not found", code: "BOARD_BLIND (blind battleship board, non-managers)" },
        },
      },
      {
        path: "/tiles/{tileId}/auto-submissions",
        method: "POST",
        description:
          "Submit an image with metadata; the server matches the metadata against the tile's goals, updates progress and completes the tile when its goals are met. Same TIER_LOCKED, BOARD_BLIND and EVENT_NOT_STARTED checks as the plain submission route.",
        request: {
          formData: {
            image: "file",
            metadata:
              "string (optional) - JSON: npcId, sourceName, itemId, quantity, accountName, sourceType, worldX, worldY, plane, worldNumber, regionId",
          },
        },
        response: {
          "...": "boardPayload (see dataStructures.boardPayload)",
          autoApproved: "boolean",
          matchedGoalId: "string | null",
          tierUnlocked:
            "number | null - Highest tier newly unlocked by this request",
          shot: "{ tileId: string, result: 'hit' | 'miss' | 'sunk' } | null - Battleship only: what the completion did to the team's marks. Null when no tile was newly marked",
        },
      },
      {
        path: "/team-drops",
        method: "GET",
        description:
          "Poll for drops submitted by teammates (excludes your own). Keyset-paginated with an opaque cursor; drops are delayed ~2s. Rate limited to 30 requests/minute per user.",
        request: {
          query: {
            since:
              "string (optional) - Opaque cursor from a previous response. Omit to receive the head cursor with no drops (no backfill).",
            limit: "number (optional) - 1-100, default 50",
            eventId:
              "string (optional) - Narrow to one event; intersected with your teams",
          },
        },
        response: {
          cursor: "string - Pass as 'since' on the next poll",
          hasMore: "boolean - More drops are available right now",
          resync:
            "boolean - Cursor older than 24h; no drops returned, restart from the returned cursor",
          pollIntervalMs: "number - Suggested poll interval (5000)",
          drops: [
            {
              id: "string",
              createdAt: "string - ISO timestamp with microseconds",
              status:
                "string - pending | approved | rejected (rejected = needs review)",
              eventId: "string",
              bingoId: "string",
              teamId: "string",
              teamName: "string",
              tileId: "string",
              tileTitle: "string",
              player: { runescapeName: "string" },
              item: { itemId: "number", quantity: "number", value: "number" },
              source: { name: "string", type: "string", npcId: "number" },
              imageUrl: "string",
            },
          ],
        },
        errors: {
          "400": { error: "Invalid cursor" },
          "401": { error: "Invalid API key" },
          "429": { error: "Too many requests (see Retry-After header)" },
        },
      },
      {
        path: "/team-tile-completions",
        method: "GET",
        description:
          "Poll for tiles completed by your teams (includes your own completions). Keyset-paginated with an opaque cursor ordered by completion time; completions are delayed ~2s. Only visible bingos. Separate rate limit of 30 requests/minute per user.",
        request: {
          query: {
            since:
              "string (optional) - Opaque cursor from a previous response. Omit to receive the head cursor with no completions (no backfill).",
            limit: "number (optional) - 1-100, default 50",
            eventId:
              "string (optional) - Narrow to one event; intersected with your teams",
          },
        },
        response: {
          cursor: "string - Pass as 'since' on the next poll",
          hasMore: "boolean - More completions are available right now",
          resync:
            "boolean - Cursor older than 24h; no completions returned, restart from the returned cursor",
          pollIntervalMs: "number - Suggested poll interval (5000)",
          completions: [
            {
              id: "string - Team tile submission id",
              completedAt: "string - ISO timestamp with microseconds",
              eventId: "string",
              bingoId: "string",
              teamId: "string",
              teamName: "string",
              tileId: "string",
              tileTitle: "string",
              tile: {
                points: "number - Tile weight",
                tier: "number - Tile tier",
              },
            },
          ],
        },
        errors: {
          "400": { error: "Invalid cursor" },
          "401": { error: "Invalid API key" },
          "429": { error: "Too many requests (see Retry-After header)" },
        },
      },
    ],
    dataStructures: {
      boardPayload: {
        description:
          "The board object returned by /bingos/{bingoId}, inside /events and by the submission routes. All 2.1 additions are additive; treat a missing bingoType as 'standard'.",
        fields: {
          apiVersion: "string - '2.1'",
          bingoType: "'standard' | 'progression' | 'battleship'",
          "tiles[].tier": "number - 0 on boards without tiers",
          "tiles[].tierLocked":
            "boolean - True for a stub tile of a tier the team has not unlocked",
          "tiles[].isBlind":
            "boolean - True for a redacted tile of a battleship board that has not started (non-managers). Present on every board type",
          progression:
            "object - Only for progression boards, and only when the user is on a team",
          battleship: "object - Only for battleship boards",
        },
      },
      progression: {
        description:
          "Tier 0 is always unlocked. A tier unlocks when the team has earned enough XP (summed tile weight) in the tier below it.",
        fields: {
          tierXpRequirements: "{ tier, xpRequired }[] - Older field, unchanged",
          unlockedTiers:
            "number[] - Older field, unchanged. Always contains 0",
          tierProgress:
            "{ tier, isUnlocked, unlockedAt }[] - Older field, unchanged",
          tiers:
            "{ tier, isUnlocked, unlockedAt, earnedXp, xpRequired }[] - One entry per tier of the board, locked tiers included. earnedXp is the summed weight of the team's completed tiles in the tier; xpRequired is the XP needed in that tier to unlock the next one",
        },
        notes: [
          "Tiles of a locked tier are stubs: id, index and tier are real, tierLocked is true, and there is no title, description, image, goals or weight",
          "Submitting to a locked tier answers 403 TIER_LOCKED with tier and xpNeeded",
          "Submission and auto-submission responses carry tierUnlocked, the highest tier newly unlocked by the request",
        ],
      },
      battleship: {
        description:
          "Always about the caller's own team. No opponent ship position is ever sent.",
        fields: {
          started: "boolean - The event's startDate has passed",
          startDate: "string - ISO timestamp",
          serverNow:
            "string - ISO timestamp of the server clock. Not part of the ETag",
          rules: "{ length, count }[] - The fleet rules, sorted ascending by length",
          marks:
            "{ hitTileIds, missTileIds, sunkTileIds } - The team's shots. Empty before the start and for a manager on no team. hitTileIds also contains the sunk tiles, so give sunk priority over hit",
          opponentShipsSunk: "number",
          opponentShipsTotal:
            "number - Total ships in the public fleet rules (sum of rules[].count)",
        },
        notes: [
          "Before the start, non-managers get blind tiles: isBlind true, title 'Tile N', no description, image, goals, weight or progress",
          "Submissions answer 404 BOARD_BLIND for a blind board and 403 EVENT_NOT_STARTED before the start",
        ],
      },
      errorCodes: {
        description:
          "Submission routes put a stable code next to the error message",
        codes: {
          TIER_LOCKED:
            "403 - The tile's tier is locked. Body also has tier and xpNeeded",
          BOARD_BLIND:
            "404 - Tile of a battleship board that has not started, requested by a non-manager",
          EVENT_NOT_STARTED:
            "403 - Battleship submit before the event's start date",
        },
      },
      goalTree: {
        description:
          "Hierarchical goal structure supporting nested goal groups with AND/OR logic",
        notes: [
          "The goalTree field is NEW in v2.0.0 and provides rich hierarchical goal data",
          "The flat goals array is maintained for backwards compatibility",
          "Goal groups can be nested arbitrarily deep",
          "AND groups require all children to be complete",
          "OR groups require at least minRequiredGoals children to be complete",
        ],
        nodeTypes: {
          goal: {
            type: "goal",
            id: "string - Goal UUID",
            orderIndex: "number - Display order within parent",
            description: "string - Goal description text",
            targetValue: "number | null - Required value to complete",
            goalType: "string - 'generic' or 'item'",
            itemGoal: {
              description: "Present when goalType is 'item'",
              itemId: "number - OSRS item ID",
              baseName: "string - Base item name (e.g. 'Amulet of glory')",
              exactVariant:
                "string | null - Specific variant if required (e.g. 'Amulet of glory (4)')",
              imageUrl: "string - Path to item icon",
            },
            goalValues: {
              description: "Pre-defined submission value options",
              structure: [
                {
                  id: "string - Goal value UUID",
                  value: "number - Submission value",
                  description:
                    "string - Description (e.g. 'Easy clue: 0.5 points')",
                },
              ],
            },
            progress: {
              description: "Present when user has a team",
              approvedProgress: "number (integer) - Approved submissions total",
              totalProgress:
                "number (integer) - All submissions total (approved + pending)",
              approvedPercentage: "number (integer) - Percentage complete (0-100)",
              isCompleted: "boolean - Whether goal is complete",
            },
          },
          group: {
            type: "group",
            id: "string - Group UUID",
            orderIndex: "number - Display order within parent",
            name: "string | null - Optional custom group name",
            logicalOperator: "string - 'AND' or 'OR'",
            minRequiredGoals:
              "number - For OR groups, minimum children that must be complete",
            children: "GoalTreeNode[] - Nested goals and/or groups",
            progress: {
              description: "Present when user has a team",
              completedCount: "number - Number of completed child goals",
              totalCount: "number - Total number of child goals (recursive)",
              isComplete: "boolean - Whether group requirements are met",
            },
          },
        },
      },
    },
    examples: {
      simpleGoalTree: {
        description: "Tile with flat goals (no groups)",
        goalTree: [
          {
            type: "goal",
            id: "goal-1",
            orderIndex: 0,
            description: "Complete 50 barrows chests",
            targetValue: 50,
            goalType: "generic",
            progress: {
              approvedProgress: 25,
              totalProgress: 25,
              approvedPercentage: 50,
              isCompleted: false,
            },
          },
        ],
      },
      nestedGoalTree: {
        description: "Tile with AND group containing item goals",
        goalTree: [
          {
            type: "group",
            id: "group-1",
            orderIndex: 0,
            name: "Barrows Requirements",
            logicalOperator: "AND",
            minRequiredGoals: 2,
            progress: {
              completedCount: 1,
              totalCount: 2,
              isComplete: false,
            },
            children: [
              {
                type: "goal",
                id: "goal-1",
                orderIndex: 0,
                description: "Complete 50 chests",
                targetValue: 50,
                goalType: "generic",
                progress: {
                  approvedProgress: 25,
                  totalProgress: 25,
                  approvedPercentage: 50,
                  isCompleted: false,
                },
              },
              {
                type: "goal",
                id: "goal-2",
                orderIndex: 1,
                description: "Ahrim's staff",
                targetValue: 1,
                goalType: "item",
                itemGoal: {
                  itemId: 4710,
                  baseName: "Ahrim's staff",
                  exactVariant: null,
                  imageUrl: "/items/4710.png",
                },
                progress: {
                  approvedProgress: 1,
                  totalProgress: 1,
                  approvedPercentage: 100,
                  isCompleted: true,
                },
              },
            ],
          },
        ],
      },
      orGroupExample: {
        description: "OR group requiring at least 2 of 4 items",
        goalTree: [
          {
            type: "group",
            id: "group-1",
            orderIndex: 0,
            name: "Get at least 2 GWD items",
            logicalOperator: "OR",
            minRequiredGoals: 2,
            progress: {
              completedCount: 1,
              totalCount: 4,
              isComplete: false,
            },
            children: [
              {
                type: "goal",
                id: "goal-1",
                orderIndex: 0,
                description: "Armadyl helmet",
                targetValue: 1,
                goalType: "item",
                itemGoal: {
                  itemId: 11826,
                  baseName: "Armadyl helmet",
                  exactVariant: null,
                  imageUrl: "/items/11826.png",
                },
                progress: {
                  approvedProgress: 1,
                  totalProgress: 1,
                  approvedPercentage: 100,
                  isCompleted: true,
                },
              },
              {
                type: "goal",
                id: "goal-2",
                orderIndex: 1,
                description: "Bandos chestplate",
                targetValue: 1,
                goalType: "item",
                itemGoal: {
                  itemId: 11832,
                  baseName: "Bandos chestplate",
                  exactVariant: null,
                  imageUrl: "/items/11832.png",
                },
                progress: {
                  approvedProgress: 0,
                  totalProgress: 0,
                  approvedPercentage: 0,
                  isCompleted: false,
                },
              },
            ],
          },
        ],
      },
      goalWithValues: {
        description: "Goal with pre-defined submission values",
        goalTree: [
          {
            type: "goal",
            id: "goal-1",
            orderIndex: 0,
            description: "Complete clue scrolls",
            targetValue: 10,
            goalType: "generic",
            goalValues: [
              {
                id: "value-1",
                value: 0.5,
                description: "Easy clue",
              },
              {
                id: "value-2",
                value: 1,
                description: "Medium clue",
              },
              {
                id: "value-3",
                value: 2,
                description: "Hard clue",
              },
              {
                id: "value-4",
                value: 3,
                description: "Elite clue",
              },
              {
                id: "value-5",
                value: 5,
                description: "Master clue",
              },
            ],
            progress: {
              approvedProgress: 4,
              totalProgress: 4,
              approvedPercentage: 40,
              isCompleted: false,
            },
          },
        ],
      },
    },
  }

  return NextResponse.json(apiDocs)
}
