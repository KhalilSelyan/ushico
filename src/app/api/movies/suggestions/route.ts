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
    const friendId = searchParams.get("friendId");

    if (!friendId) {
      return NextResponse.json(
        { error: "Friend ID required" },
        { status: 400 }
      );
    }

    const tmdbApiKey = process.env.TMDB_API_KEY;
    if (!tmdbApiKey) {
      console.error("TMDB_API_KEY environment variable is not set");
      return NextResponse.json(
        { error: "TMDB API key not configured" },
        { status: 500 }
      );
    }

    // Popular genres for movie suggestions
    const popularGenres = [
      { id: 28, name: "Action" },
      { id: 35, name: "Comedy" },
      { id: 10749, name: "Romance" },
      { id: 878, name: "Science Fiction" },
      { id: 53, name: "Thriller" },
    ];

    // Get 5 movies from each genre
    const genreSuggestions = await Promise.all(
      popularGenres.map(async (genre) => {
        try {
          const response = await fetch(
            `https://api.themoviedb.org/3/discover/movie?api_key=${tmdbApiKey}&with_genres=${genre.id}&sort_by=popularity.desc&page=1&language=en-US&include_adult=false`,
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

          // Take first 5 movies from each genre
          const movies = (data.results || []).slice(0, 5).map((movie: any) => ({
            id: movie.id,
            title: movie.title,
            overview: movie.overview,
            poster_path: movie.poster_path,
            release_date: movie.release_date,
            vote_average: movie.vote_average,
            genre_ids: movie.genre_ids,
            genre_name: genre.name,
          }));

          return {
            genre: genre.name,
            genre_id: genre.id,
            movies,
          };
        } catch (error) {
          console.error(`Error fetching ${genre.name} movies:`, error);
          return {
            genre: genre.name,
            genre_id: genre.id,
            movies: [],
          };
        }
      })
    );

    return NextResponse.json({
      suggestions: genreSuggestions,
      sessionId: session.user.id,
      friendId,
    });
  } catch (error) {
    console.error("Error generating movie suggestions:", error);
    return NextResponse.json(
      { error: "Failed to generate movie suggestions" },
      { status: 500 }
    );
  }
}
