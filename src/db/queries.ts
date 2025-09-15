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
  room,
  roomParticipant,
  roomMessage,
  roomInvitation,
  type Room,
  type NewRoom,
  type RoomParticipant,
  type NewRoomParticipant,
  type RoomMessage,
  type NewRoomMessage,
  type RoomInvitation,
  type NewRoomInvitation,
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

// Room management functions
export async function createRoom(
  hostId: string,
  name: string,
  initialParticipants: string[] = []
): Promise<Room> {
  const roomCode = await generateRoomCode();

  const [newRoom] = await db
    .insert(room)
    .values({
      id: nanoid(),
      name,
      hostId,
      isActive: true,
      maxParticipants: "10",
      roomCode,
      createdAt: new Date(),
      updatedAt: new Date(),
    } satisfies NewRoom)
    .returning();

  // Add host as participant
  await db.insert(roomParticipant).values({
    id: nanoid(),
    roomId: newRoom.id,
    userId: hostId,
    role: "host",
    joinedAt: new Date(),
  });

  // Add initial participants
  if (initialParticipants.length > 0) {
    await db.insert(roomParticipant).values(
      initialParticipants.map((userId) => ({
        id: nanoid(),
        roomId: newRoom.id,
        userId,
        role: "viewer" as const,
        joinedAt: new Date(),
      }))
    );
  }

  return newRoom;
}

export async function getRoomById(roomId: string) {
  const roomData = await db.query.room.findFirst({
    where: eq(room.id, roomId),
    with: {
      host: true,
      participants: {
        with: {
          user: true,
        },
      },
      messages: {
        with: {
          sender: true,
        },
        limit: 50,
        orderBy: (messages, { desc }) => [desc(messages.timestamp)],
      },
    },
  });

  return roomData;
}

export async function getUserRooms(userId: string): Promise<Room[]> {
  const participations = await db.query.roomParticipant.findMany({
    where: eq(roomParticipant.userId, userId),
    with: {
      room: true,
    },
  });

  return participations
    .filter((p) => p.room.isActive)
    .map((p) => p.room);
}

export async function joinRoom(roomId: string, userId: string): Promise<void> {
  // Check if user is already in room
  const existingParticipant = await db.query.roomParticipant.findFirst({
    where: and(
      eq(roomParticipant.roomId, roomId),
      eq(roomParticipant.userId, userId)
    ),
  });

  if (existingParticipant) {
    throw new Error("User is already in room");
  }

  await db.insert(roomParticipant).values({
    id: nanoid(),
    roomId,
    userId,
    role: "viewer",
    joinedAt: new Date(),
  });
}

export async function leaveRoom(roomId: string, userId: string): Promise<void> {
  await db
    .delete(roomParticipant)
    .where(
      and(
        eq(roomParticipant.roomId, roomId),
        eq(roomParticipant.userId, userId)
      )
    );
}

export async function transferRoomHost(roomId: string, newHostId: string): Promise<void> {
  await db.transaction(async (tx) => {
    // Update room host
    await tx
      .update(room)
      .set({ hostId: newHostId, updatedAt: new Date() })
      .where(eq(room.id, roomId));

    // Update old host to viewer
    await tx
      .update(roomParticipant)
      .set({ role: "viewer" })
      .where(
        and(
          eq(roomParticipant.roomId, roomId),
          eq(roomParticipant.role, "host")
        )
      );

    // Update new host to host role
    await tx
      .update(roomParticipant)
      .set({ role: "host" })
      .where(
        and(
          eq(roomParticipant.roomId, roomId),
          eq(roomParticipant.userId, newHostId)
        )
      );
  });
}

export async function validateRoomAccess(roomId: string, userId: string): Promise<boolean> {
  const participant = await db.query.roomParticipant.findFirst({
    where: and(
      eq(roomParticipant.roomId, roomId),
      eq(roomParticipant.userId, userId)
    ),
  });

  return !!participant;
}

export async function isRoomHost(roomId: string, userId: string): Promise<boolean> {
  const roomData = await db.query.room.findFirst({
    where: and(eq(room.id, roomId), eq(room.hostId, userId)),
  });

  return !!roomData;
}

// Room message functions
export async function sendRoomMessage(
  roomId: string,
  senderId: string,
  text: string
): Promise<RoomMessage> {
  // Validate user is in room
  const isParticipant = await validateRoomAccess(roomId, senderId);
  if (!isParticipant) {
    throw new Error("User is not in room");
  }

  const [newMessage] = await db
    .insert(roomMessage)
    .values({
      id: nanoid(),
      roomId,
      senderId,
      text,
      timestamp: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    } satisfies NewRoomMessage)
    .returning();

  return newMessage;
}

export async function getRoomMessages(
  roomId: string,
  limit: number = 50
) {
  const messages = await db.query.roomMessage.findMany({
    where: eq(roomMessage.roomId, roomId),
    with: {
      sender: true,
    },
    limit,
    orderBy: (messages, { desc }) => [desc(messages.timestamp)],
  });

  return messages.map((msg) => ({
    ...msg,
    timestamp: new Date(msg.timestamp.getTime()),
  }));
}

// Room invitation functions
export async function createRoomInvitation(
  roomId: string,
  inviterId: string,
  inviteeId: string
): Promise<RoomInvitation> {
  // Check if inviter is host or participant
  const isParticipant = await validateRoomAccess(roomId, inviterId);
  if (!isParticipant) {
    throw new Error("Inviter is not in room");
  }

  // Check if invitee is already in room
  const isAlreadyInRoom = await validateRoomAccess(roomId, inviteeId);
  if (isAlreadyInRoom) {
    throw new Error("User is already in room");
  }

  // Check if invitation already exists
  const existingInvitation = await db.query.roomInvitation.findFirst({
    where: and(
      eq(roomInvitation.roomId, roomId),
      eq(roomInvitation.inviteeId, inviteeId),
      eq(roomInvitation.status, "pending")
    ),
  });

  if (existingInvitation) {
    throw new Error("Invitation already exists");
  }

  const [newInvitation] = await db
    .insert(roomInvitation)
    .values({
      id: nanoid(),
      roomId,
      inviterId,
      inviteeId,
      status: "pending",
      createdAt: new Date(),
      updatedAt: new Date(),
    } satisfies NewRoomInvitation)
    .returning();

  return newInvitation;
}

export async function respondToRoomInvitation(
  invitationId: string,
  status: "accepted" | "declined"
): Promise<void> {
  const invitation = await db.query.roomInvitation.findFirst({
    where: eq(roomInvitation.id, invitationId),
  });

  if (!invitation) {
    throw new Error("Invitation not found");
  }

  if (invitation.status !== "pending") {
    throw new Error("Invitation already responded to");
  }

  await db.transaction(async (tx) => {
    // Update invitation status
    await tx
      .update(roomInvitation)
      .set({ status, updatedAt: new Date() })
      .where(eq(roomInvitation.id, invitationId));

    // If accepted, add user to room
    if (status === "accepted") {
      await tx.insert(roomParticipant).values({
        id: nanoid(),
        roomId: invitation.roomId,
        userId: invitation.inviteeId,
        role: "viewer",
        joinedAt: new Date(),
      });
    }
  });
}

export async function getUserRoomInvitations(userId: string) {
  const invitations = await db.query.roomInvitation.findMany({
    where: and(
      eq(roomInvitation.inviteeId, userId),
      eq(roomInvitation.status, "pending")
    ),
    with: {
      room: {
        with: {
          host: true,
        },
      },
      inviter: true,
    },
  });

  return invitations;
}

// Utility functions
export async function generateRoomCode(): Promise<string> {
  let code: string;
  let exists = true;

  do {
    // Generate 6-character alphanumeric code
    code = Math.random().toString(36).substring(2, 8).toUpperCase();

    const existing = await db.query.room.findFirst({
      where: eq(room.roomCode, code),
    });

    exists = !!existing;
  } while (exists);

  return code;
}

export async function getRoomByCode(code: string): Promise<Room | null> {
  const roomData = await db.query.room.findFirst({
    where: eq(room.roomCode, code),
  });

  return roomData || null;
}

export async function deactivateRoom(roomId: string): Promise<void> {
  await db
    .update(room)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(room.id, roomId));
}
