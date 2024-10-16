import { fetchRedis } from "@/helpers/redis";
import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

import { UnstorageAdapter } from "@auth/unstorage-adapter";
import { createStorage } from "unstorage";
import redisDriver from "unstorage/drivers/redis";

const storage = createStorage({
  driver: redisDriver({
    base: "unstorage",
    host: process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT || "6379"),
    password: process.env.REDIS_PASSWORD,
    tls: false as any,
  }),
});

function getGoogleCredentials() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || clientId.length === 0) {
    throw new Error("Missing GOOGLE_CLIENT_ID env variable");
  }
  if (!clientSecret || clientSecret.length === 0) {
    throw new Error("Missing GOOGLE_CLIENT_SECRET env variable");
  }

  return { clientId, clientSecret };
}

export const authOptions: NextAuthOptions = {
  adapter: UnstorageAdapter(storage),
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    GoogleProvider({
      clientId: getGoogleCredentials().clientId,
      clientSecret: getGoogleCredentials().clientSecret,
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      // If user is defined, this is the initial sign-in
      if (user) {
        token.id = user.id;
        token.sub = user.id; // Ensure 'sub' is set
      } else {
        // If token.id is defined, fetch the user from Redis
        const dbUserResult = await fetchRedis(
          "get",
          `unstorage:user:${token.id}`
        );
        if (dbUserResult) {
          const dbUser = JSON.parse(dbUserResult) as User;
          token = {
            ...token,
            id: dbUser.id,
            sub: dbUser.id,
            name: dbUser.name,
            email: dbUser.email,
            picture: dbUser.image,
          };
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id;
        session.user.name = token.name;
        session.user.email = token.email;
        session.user.image = token.picture;
      }
      return session;
    },
    redirect() {
      return "/dashboard";
    },
  },
};
