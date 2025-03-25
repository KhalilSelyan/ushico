import { and, eq, or, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import db from "./index";
import {
  type FriendRequest,
  friendRequest,
  message,
  type NewFriendRequest,
  type NewMessage,
  user,
  friend,
} from "./schema";
import type { Message, User } from "./schema";

export async function getFriendsById(userId: string) {
  const friends = await db.query.friend.findMany({
    where: eq(friend.userId, userId),
    with: {
      friend: true,
    },
  });

  return friends.map((f) => f.friend);
}

export async function getUnseenFriendRequestCount(userId: string) {
  const count = await db
    .select({ count: sql<number>`count(*)` })
    .from(friendRequest)
    .where(eq(friendRequest.receiverId, userId));

  return count[0].count;
}

export async function getChatMessages(chatId: string): Promise<Message[]> {
  const [userId1, userId2] = chatId.split("--");
  const messages = await db.query.message.findMany({
    where: or(
      and(eq(message.senderId, userId1), eq(message.receiverId, userId2)),
      and(eq(message.senderId, userId2), eq(message.receiverId, userId1))
    ),
    orderBy: (messages, { desc }) => [desc(messages.timestamp)],
  });

  return messages.map((msg: Message) => ({
    ...msg,
    timestamp: new Date(msg.timestamp.getTime()),
  }));
}

export async function sendMessage({
  chatId,
  senderId,
  text,
}: {
  chatId: string;
  senderId: string;
  text: string;
}): Promise<Message> {
  const [userId1, userId2] = chatId.split("--");
  const receiverId = senderId === userId1 ? userId2 : userId1;

  // Check if users are friends
  const friendship = await db.query.friend.findFirst({
    where: and(eq(friend.userId, senderId), eq(friend.friendId, receiverId)),
  });

  if (!friendship) {
    throw new Error("Users are not friends");
  }

  const [newMessage] = await db
    .insert(message)
    .values({
      id: nanoid(),
      senderId,
      receiverId,
      text,
      timestamp: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  return {
    ...newMessage,
    timestamp: new Date(newMessage.timestamp.getTime()),
  };
}

export async function getFriendRequests(userId: string) {
  const requests = await db.query.friendRequest.findMany({
    where: eq(friendRequest.receiverId, userId),
    with: {
      sender: true,
    },
  });

  return requests.map((request: FriendRequest & { sender: User }) => ({
    senderId: request.senderId,
    senderEmail: request.sender.email,
  }));
}

export async function acceptFriendRequest(
  receiverId: string,
  senderId: string
) {
  // First check if they're already friends
  const existingFriendship = await db.query.friend.findFirst({
    where: and(eq(friend.userId, receiverId), eq(friend.friendId, senderId)),
  });

  if (existingFriendship) {
    throw new Error("Already friends");
  }

  // Check if request exists
  const request = await db.query.friendRequest.findFirst({
    where: and(
      eq(friendRequest.receiverId, receiverId),
      eq(friendRequest.senderId, senderId)
    ),
  });

  if (!request) {
    throw new Error("No friend request");
  }

  // Create friendship and delete request
  await db.transaction(async (tx) => {
    await tx.insert(friend).values({
      id: nanoid(),
      userId: receiverId,
      friendId: senderId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await tx.insert(friend).values({
      id: nanoid(),
      userId: senderId,
      friendId: receiverId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await tx
      .delete(friendRequest)
      .where(
        and(
          eq(friendRequest.receiverId, receiverId),
          eq(friendRequest.senderId, senderId)
        )
      );
  });
}

export async function denyFriendRequest(receiverId: string, senderId: string) {
  const request = await db.query.friendRequest.findFirst({
    where: and(
      eq(friendRequest.receiverId, receiverId),
      eq(friendRequest.senderId, senderId)
    ),
  });

  if (!request) {
    throw new Error("No friend request");
  }

  await db
    .delete(friendRequest)
    .where(
      and(
        eq(friendRequest.receiverId, receiverId),
        eq(friendRequest.senderId, senderId)
      )
    );
}

export async function sendFriendRequest(
  senderId: string,
  receiverId: string
): Promise<FriendRequest> {
  const [newRequest] = await db
    .insert(friendRequest)
    .values({
      id: nanoid(),
      senderId,
      receiverId,
      status: "pending",
      createdAt: new Date(),
      updatedAt: new Date(),
    } satisfies NewFriendRequest)
    .returning();

  return newRequest;
}

export async function checkIfFriends(userId1: string, userId2: string) {
  const result = await db
    .select()
    .from(friendRequest)
    .where(
      and(
        or(
          and(
            eq(friendRequest.senderId, userId1),
            eq(friendRequest.receiverId, userId2)
          ),
          and(
            eq(friendRequest.senderId, userId2),
            eq(friendRequest.receiverId, userId1)
          )
        ),
        eq(friendRequest.status, "accepted")
      )
    );

  return result.length > 0;
}

export async function checkIfFriendRequestExists(
  senderId: string,
  receiverId: string
) {
  const result = await db
    .select()
    .from(friendRequest)
    .where(
      and(
        eq(friendRequest.senderId, senderId),
        eq(friendRequest.receiverId, receiverId),
        eq(friendRequest.status, "pending")
      )
    );

  return result.length > 0;
}

export async function getUserById(id: string): Promise<User | null> {
  const result = await db.query.user.findFirst({
    where: eq(user.id, id),
  });
  return result || null;
}
