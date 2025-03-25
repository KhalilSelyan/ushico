import { getFriendsById as getFriendsFromDb } from "@/db/queries";
import { user as userTable } from "@/db/schema";
import { eq } from "drizzle-orm";
import type { User } from "@/db/schema";
import db from "@/db";

export async function getFriendsById(id: string): Promise<User[]> {
  return getFriendsFromDb(id);
}

export async function getSpecificUserById(id: string): Promise<User | null> {
  const result = await db.query.user.findFirst({
    where: eq(userTable.id, id),
  });
  return result ?? null;
}
