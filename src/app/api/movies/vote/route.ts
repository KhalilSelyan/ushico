import { and, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth/auth";
import db from "@/db";
import { movie, movieVote } from "@/db/schema";

export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: headers(),
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      tmdbId,
      title,
      overview,
      posterPath,
      releaseDate,
      voteAverage,
      genreIds,
      vote,
    } = body;

    if (!tmdbId || !title || !vote) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (!["upvote", "downvote", "neutral"].includes(vote)) {
      return NextResponse.json({ error: "Invalid vote type" }, { status: 400 });
    }

    // Check if movie exists, if not create it
    let existingMovie = await db.query.movie.findFirst({
      where: (movie, { eq }) => eq(movie.tmdbId, tmdbId),
    });

    if (!existingMovie) {
      const newMovie = await db
        .insert(movie)
        .values({
          id: nanoid(),
          tmdbId,
          title,
          overview,
          posterPath,
          releaseDate,
          voteAverage: voteAverage?.toString(),
          genreIds: genreIds ? JSON.stringify(genreIds) : null,
        })
        .returning();

      existingMovie = newMovie[0];
    }

    // Check if user already voted on this movie
    const existingVote = await db.query.movieVote.findFirst({
      where: (vote, { and, eq }) =>
        and(
          eq(vote.userId, session.user.id),
          eq(vote.movieId, existingMovie!.id)
        ),
    });

    if (existingVote) {
      // Update existing vote
      await db
        .update(movieVote)
        .set({ vote, updatedAt: new Date() })
        .where(
          and(
            eq(movieVote.userId, session.user.id),
            eq(movieVote.movieId, existingMovie!.id)
          )
        );
    } else {
      // Create new vote
      await db.insert(movieVote).values({
        id: nanoid(),
        userId: session.user.id,
        movieId: existingMovie!.id,
        vote,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error voting on movie:", error);
    return NextResponse.json(
      { error: "Failed to vote on movie" },
      { status: 500 }
    );
  }
}
