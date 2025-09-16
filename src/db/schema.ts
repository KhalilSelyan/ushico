import { relations } from "drizzle-orm";
import { boolean, pgTableCreator, text, timestamp } from "drizzle-orm/pg-core";

const creator = pgTableCreator((name) => `${name}_table`);

export const user = creator("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull(),
  image: text("image"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
  sentMessages: many(message, { relationName: "sentMessages" }),
  receivedMessages: many(message, { relationName: "receivedMessages" }),
  sentFriendRequests: many(friendRequest, {
    relationName: "sentFriendRequests",
  }),
  receivedFriendRequests: many(friendRequest, {
    relationName: "receivedFriendRequests",
  }),
  friends: many(friend, { relationName: "userFriends" }),
  friendOf: many(friend, { relationName: "friendOf" }),
  movieVotes: many(movieVote),
  hostedRooms: many(room),
  roomParticipations: many(roomParticipant),
  roomMessages: many(roomMessage),
  sentRoomInvitations: many(roomInvitation, { relationName: "sentRoomInvitations" }),
  receivedRoomInvitations: many(roomInvitation, { relationName: "receivedRoomInvitations" }),
}));

export type User = typeof user.$inferSelect;
export type NewUser = typeof user.$inferInsert;

export const session = creator("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}));

export type Session = typeof session.$inferSelect;
export type NewSession = typeof session.$inferInsert;

export const account = creator("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}));

export type Account = typeof account.$inferSelect;
export type NewAccount = typeof account.$inferInsert;

export const verification = creator("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
});

export type Verification = typeof verification.$inferSelect;
export type NewVerification = typeof verification.$inferInsert;

export const message = creator("message", {
  id: text("id").primaryKey(),
  senderId: text("sender_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  receiverId: text("receiver_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  text: text("text").notNull(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const messageRelations = relations(message, ({ one }) => ({
  sender: one(user, {
    fields: [message.senderId],
    references: [user.id],
    relationName: "sentMessages",
  }),
  receiver: one(user, {
    fields: [message.receiverId],
    references: [user.id],
    relationName: "receivedMessages",
  }),
}));

export type Message = typeof message.$inferSelect;
export type NewMessage = typeof message.$inferInsert;

export const friendRequest = creator("friend_request", {
  id: text("id").primaryKey(),
  senderId: text("sender_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  receiverId: text("receiver_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("pending"), // pending, accepted, rejected
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const friendRequestRelations = relations(friendRequest, ({ one }) => ({
  sender: one(user, {
    fields: [friendRequest.senderId],
    references: [user.id],
    relationName: "sentFriendRequests",
  }),
  receiver: one(user, {
    fields: [friendRequest.receiverId],
    references: [user.id],
    relationName: "receivedFriendRequests",
  }),
}));

export type FriendRequest = typeof friendRequest.$inferSelect;
export type NewFriendRequest = typeof friendRequest.$inferInsert;

export const friend = creator("friend", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  friendId: text("friend_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const friendRelations = relations(friend, ({ one }) => ({
  user: one(user, {
    fields: [friend.userId],
    references: [user.id],
    relationName: "userFriends",
  }),
  friend: one(user, {
    fields: [friend.friendId],
    references: [user.id],
    relationName: "friendOf",
  }),
}));

export type Friend = typeof friend.$inferSelect;
export type NewFriend = typeof friend.$inferInsert;

export const movie = creator("movie", {
  id: text("id").primaryKey(),
  tmdbId: text("tmdb_id").notNull().unique(),
  title: text("title").notNull(),
  overview: text("overview"),
  posterPath: text("poster_path"),
  releaseDate: text("release_date"),
  voteAverage: text("vote_average"),
  genreIds: text("genre_ids"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const movieRelations = relations(movie, ({ many }) => ({
  votes: many(movieVote),
}));

export type Movie = typeof movie.$inferSelect;
export type NewMovie = typeof movie.$inferInsert;

export const movieVote = creator("movie_vote", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  movieId: text("movie_id")
    .notNull()
    .references(() => movie.id, { onDelete: "cascade" }),
  vote: text("vote").notNull(), // "upvote", "downvote", or "neutral"
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const movieVoteRelations = relations(movieVote, ({ one }) => ({
  user: one(user, {
    fields: [movieVote.userId],
    references: [user.id],
  }),
  movie: one(movie, {
    fields: [movieVote.movieId],
    references: [movie.id],
  }),
}));

export type MovieVote = typeof movieVote.$inferSelect;
export type NewMovieVote = typeof movieVote.$inferInsert;

// Room table
export const room = creator("room", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  hostId: text("host_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  isActive: boolean("is_active").notNull().default(true),
  isEphemeral: boolean("is_ephemeral").notNull().default(false), // Auto-delete after 24 hours
  expiresAt: timestamp("expires_at"), // When ephemeral room expires
  maxParticipants: text("max_participants").default("10"), // Optional limit
  roomCode: text("room_code").unique(), // Optional invite code
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Room participants
export const roomParticipant = creator("room_participant", {
  id: text("id").primaryKey(),
  roomId: text("room_id")
    .notNull()
    .references(() => room.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  role: text("role").notNull(), // "host" | "viewer"
  joinedAt: timestamp("joined_at").notNull().defaultNow(),
});

// Room messages (separate from direct messages)
export const roomMessage = creator("room_message", {
  id: text("id").primaryKey(),
  roomId: text("room_id")
    .notNull()
    .references(() => room.id, { onDelete: "cascade" }),
  senderId: text("sender_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  text: text("text").notNull(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Room invitations
export const roomInvitation = creator("room_invitation", {
  id: text("id").primaryKey(),
  roomId: text("room_id")
    .notNull()
    .references(() => room.id, { onDelete: "cascade" }),
  inviterId: text("inviter_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  inviteeId: text("invitee_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("pending"), // pending, accepted, declined
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const roomRelations = relations(room, ({ one, many }) => ({
  host: one(user, {
    fields: [room.hostId],
    references: [user.id],
  }),
  participants: many(roomParticipant),
  messages: many(roomMessage),
  invitations: many(roomInvitation),
  joinRequests: many(roomJoinRequest),
}));

export const roomParticipantRelations = relations(roomParticipant, ({ one }) => ({
  room: one(room, {
    fields: [roomParticipant.roomId],
    references: [room.id],
  }),
  user: one(user, {
    fields: [roomParticipant.userId],
    references: [user.id],
  }),
}));

export const roomMessageRelations = relations(roomMessage, ({ one }) => ({
  room: one(room, {
    fields: [roomMessage.roomId],
    references: [room.id],
  }),
  sender: one(user, {
    fields: [roomMessage.senderId],
    references: [user.id],
  }),
}));

export const roomInvitationRelations = relations(roomInvitation, ({ one }) => ({
  room: one(room, {
    fields: [roomInvitation.roomId],
    references: [room.id],
  }),
  inviter: one(user, {
    fields: [roomInvitation.inviterId],
    references: [user.id],
    relationName: "sentRoomInvitations",
  }),
  invitee: one(user, {
    fields: [roomInvitation.inviteeId],
    references: [user.id],
    relationName: "receivedRoomInvitations",
  }),
}));

export type Room = typeof room.$inferSelect;
export type NewRoom = typeof room.$inferInsert;
export type RoomParticipant = typeof roomParticipant.$inferSelect;
export type NewRoomParticipant = typeof roomParticipant.$inferInsert;
export type RoomMessage = typeof roomMessage.$inferSelect;
export type NewRoomMessage = typeof roomMessage.$inferInsert;
export type RoomInvitation = typeof roomInvitation.$inferSelect;
export type NewRoomInvitation = typeof roomInvitation.$inferInsert;

// Room join requests
export const roomJoinRequest = creator("room_join_request", {
  id: text("id").primaryKey(),
  roomId: text("room_id")
    .notNull()
    .references(() => room.id, { onDelete: "cascade" }),
  requesterId: text("requester_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("pending"), // pending, approved, denied
  message: text("message"), // Optional message from requester
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const roomJoinRequestRelations = relations(roomJoinRequest, ({ one }) => ({
  room: one(room, {
    fields: [roomJoinRequest.roomId],
    references: [room.id],
  }),
  requester: one(user, {
    fields: [roomJoinRequest.requesterId],
    references: [user.id],
  }),
}));

export type RoomJoinRequest = typeof roomJoinRequest.$inferSelect;
export type NewRoomJoinRequest = typeof roomJoinRequest.$inferInsert;
