import { NextResponse } from "next/server"

// API documentation for the RuneLite plugin
export async function GET() {
  const apiDocs = {
    version: "2.0.0",
    baseUrl: "/api/runelite",
    description: "API for the BingoScape RuneLite plugin",
    changelog: {
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
        description: "Get all events for the authenticated user",
        response: [
          {
            id: "string",
            title: "string",
            description: "string",
            startDate: "date",
            endDate: "date",
            userTeam: {
              id: "string",
              name: "string",
              isLeader: "boolean",
            },
            role: "string",
            bingos: [
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
        ],
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
        response: {
          success: "boolean",
          teamId: "string",
          teamName: "string",
          status: "string",
          submission: {
            id: "string",
            createdAt: "date",
            image: {
              path: "string",
            },
          },
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
