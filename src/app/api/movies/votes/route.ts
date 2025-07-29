import { and, eq, or } from "drizzle-orm";
import { headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth/auth";
import db from "@/db";
import { movie, movieVote } from "@/db/schema";

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: headers(),
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const friendId = searchParams.get("friendId");

    if (!friendId) {
      return NextResponse.json(
        { error: "Friend ID required" },
        { status: 400 }
      );
    }

    // Get all movies that either user has voted on
    const votes = await db
      .select({
        movieId: movieVote.movieId,
        userId: movieVote.userId,
        vote: movieVote.vote,
        movie: {
          id: movie.id,
          tmdbId: movie.tmdbId,
          title: movie.title,
          overview: movie.overview,
          posterPath: movie.posterPath,
          releaseDate: movie.releaseDate,
          voteAverage: movie.voteAverage,
        },
      })
      .from(movieVote)
      .innerJoin(movie, eq(movieVote.movieId, movie.id))
      .where(
        and(
          or(
            eq(movieVote.userId, session.user.id),
            eq(movieVote.userId, friendId)
          )
        )
      );

    // Group votes by movie
    const movieVotesMap = new Map();

    votes.forEach((vote) => {
      if (!movieVotesMap.has(vote.movieId)) {
        movieVotesMap.set(vote.movieId, {
          movie: vote.movie,
          votes: {},
        });
      }
      movieVotesMap.get(vote.movieId).votes[vote.userId] = vote.vote;
    });

    // Categorize movies
    const bothUpvoted = [];
    const bothDownvoted = [];
    const userUpvoted = [];
    const friendUpvoted = [];
    const userDownvoted = [];
    const friendDownvoted = [];

    for (const [movieId, data] of movieVotesMap) {
      const userVote = data.votes[session.user.id];
      const friendVote = data.votes[friendId];

      if (userVote === "upvote" && friendVote === "upvote") {
        bothUpvoted.push(data.movie);
      } else if (userVote === "downvote" && friendVote === "downvote") {
        bothDownvoted.push(data.movie);
      } else if (userVote === "upvote" && friendVote !== "upvote") {
        userUpvoted.push(data.movie);
      } else if (friendVote === "upvote" && userVote !== "upvote") {
        friendUpvoted.push(data.movie);
      } else if (userVote === "downvote" && friendVote !== "downvote") {
        userDownvoted.push(data.movie);
      } else if (friendVote === "downvote" && userVote !== "downvote") {
        friendDownvoted.push(data.movie);
      }
    }

    return NextResponse.json({
      bothUpvoted,
      bothDownvoted,
      userUpvoted,
      friendUpvoted,
      userDownvoted,
      friendDownvoted,
    });
  } catch (error) {
    console.error("Error getting movie votes:", error);
    return NextResponse.json(
      { error: "Failed to get movie votes" },
      { status: 500 }
    );
  }
}
