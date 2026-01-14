"use server";
import { db } from "@/server/db";
import { goalGroups } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { type GoalGroup } from "./goal-groups";

/**
 * Check if moving a group would create a circular reference
 */
export async function checkCircularReference(groupId: string, targetGroupId: string): Promise<boolean> {
    let currentId: string | null = targetGroupId;

    while (currentId) {
        if (currentId === groupId) {
            return true; // Circular reference detected
        }

        const parent: GoalGroup | undefined = await db.query.goalGroups.findFirst({
            where: eq(goalGroups.id, currentId),
        });

        currentId = parent?.parentGroupId ?? null;
    }

    return false;
}
