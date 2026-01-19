/* eslint-disable */
"use server";
import { db } from "@/server/db";
import { logger } from "@/lib/logger";
import { bingos, tiles } from "@/server/db/schema";
import { eq, asc } from "drizzle-orm";
import { BingoData } from "./bingo";


export async function getBingoById(bingoId: string): Promise<BingoData | null> {
    try {
        const result = await db.query.bingos.findFirst({
            where: eq(bingos.id, bingoId),
            with: {
                tiles: {
                    with: {
                        goals: true,
                    },
                    orderBy: [asc(tiles.index)],
                },
            },
        });

        if (!result) {
            return null;
        }

        return result;
    } catch (error) {
        logger.error({ error }, "Error fetching bingo:", error);
        throw new Error("Failed to fetch bingo");
    }
}
