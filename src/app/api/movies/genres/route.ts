import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/auth/auth";

export async function GET() {
  try {
    const session = await auth.api.getSession({
      headers: headers(),
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tmdbApiKey = process.env.TMDB_API_KEY;
    if (!tmdbApiKey) {
      console.error("TMDB_API_KEY environment variable is not set");
      return NextResponse.json(
        {
          error:
            "TMDB API key not configured. Please add TMDB_API_KEY to your environment variables.",
        },
        { status: 500 }
      );
    }

    const response = await fetch(
      `https://api.themoviedb.org/3/genre/movie/list?api_key=${tmdbApiKey}&language=en-US`,
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      throw new Error(`TMDB API error: ${response.status}`);
    }

    const data = await response.json();

    return NextResponse.json({
      genres: data.genres || [],
    });
  } catch (error) {
    console.error("Error fetching genres:", error);
    return NextResponse.json(
      { error: "Failed to fetch genres" },
      { status: 500 }
    );
  }
}
