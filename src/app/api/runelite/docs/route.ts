import { NextResponse } from "next/server"

// API documentation for the RuneLite plugin
export async function GET() {
  const apiDocs = {
    version: "1.0.0",
    baseUrl: "/api/runelite",
    description: "API for the BingoScape RuneLite plugin",
    authentication: {
      type: "Bearer Token",
      description: "All endpoints require an API key to be passed in the Authorization header as a Bearer token",
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
    ],
  }

  return NextResponse.json(apiDocs)
}

