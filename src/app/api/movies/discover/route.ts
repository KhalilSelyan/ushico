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
    const genreId = searchParams.get("genreId");
    const page = searchParams.get("page") || "1";
    const sortBy = searchParams.get("sortBy") || "popularity.desc";

    if (!genreId) {
      return NextResponse.json(
        { error: "Genre ID parameter required" },
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
      `https://api.themoviedb.org/3/discover/movie?api_key=${tmdbApiKey}&with_genres=${genreId}&sort_by=${sortBy}&page=${page}&language=en-US&include_adult=false`,
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
      totalPages: data.total_pages || 0,
      currentPage: data.page || 1,
    });
  } catch (error) {
    console.error("Error discovering movies:", error);
    return NextResponse.json(
      { error: "Failed to discover movies" },
      { status: 500 }
    );
  }
}
