 
"use server";
import { db } from "@/server/db";
import { logger } from "@/lib/logger";
import { teamTileSubmissions } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import type { TeamTileSubmission } from "./events";

// Update the getSubmissions function to include goal information

export async function getSubmissions(tileId: string): Promise<TeamTileSubmission[]> {
    try {
        const result = await db.query.teamTileSubmissions.findMany({
            with: {
                submissions: {
                    with: {
                        image: true,
                        user: true,
                        goal: true, // Include goal information
                    },
                },
                team: true,
            },
            where: eq(teamTileSubmissions.tileId, tileId),
        });

        return result;
    } catch (error) {
        logger.error({ error }, "Error fetching submissions:", error);
        throw new Error("Failed to fetch submissions");
    }
}
