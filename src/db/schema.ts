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
