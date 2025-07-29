import { headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth/auth";

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: headers(),
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q");

    if (!query) {
      return NextResponse.json(
        { error: "Query parameter required" },
        { status: 400 }
      );
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
      `https://api.themoviedb.org/3/search/movie?api_key=${tmdbApiKey}&query=${encodeURIComponent(
        query
      )}&language=en-US&page=1&include_adult=false`,
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
      movies: data.results || [],
      totalResults: data.total_results || 0,
    });
  } catch (error) {
    console.error("Error searching movies:", error);
    return NextResponse.json(
      { error: "Failed to search movies" },
      { status: 500 }
    );
  }
}
