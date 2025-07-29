/* eslint-disable @next/next/no-img-element */
"use client";

import type { Session, User } from "better-auth";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Icons } from "@/components/Icons";
import Button from "@/components/ui/Button";

interface Movie {
  id: number;
  title: string;
  overview: string;
  poster_path: string;
  release_date: string;
  vote_average: number;
  genre_ids: number[];
}

interface Genre {
  id: number;
  name: string;
}

interface MoviesPageClientProps {
  session: {
    user: User;
  };
}

export default function MoviesPageClient({ session }: MoviesPageClientProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [movies, setMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedFriend, setSelectedFriend] = useState<string | null>(null);
  const [friends, setFriends] = useState<any[]>([]);
  const [comparisonData, setComparisonData] = useState<any>(null);
  const [userVotes, setUserVotes] = useState<Record<string, string>>({});
  const [genres, setGenres] = useState<Genre[]>([]);
  const [selectedGenre, setSelectedGenre] = useState<number | null>(null);
  const [searchMode, setSearchMode] = useState<"text" | "genre">("text");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);

  useEffect(() => {
    const loadFriends = async () => {
      try {
        const response = await fetch("/api/friends/list");
        if (!response.ok) throw new Error("Failed to load friends");

        const data = await response.json();
        setFriends(data.friends || []);
      } catch (error) {
        console.error("Error loading friends:", error);
      }
    };

    const loadGenres = async () => {
      try {
        const response = await fetch("/api/movies/genres");
        if (!response.ok) throw new Error("Failed to load genres");

        const data = await response.json();
        setGenres(data.genres || []);
      } catch (error) {
        console.error("Error loading genres:", error);
      }
    };

    loadFriends();
    loadGenres();
  }, []);

  // Auto-search when page changes for genre browsing
  useEffect(() => {
    if (searchMode === "genre" && selectedGenre && currentPage > 1) {
      const loadMovies = async () => {
        setLoading(true);
        try {
          const response = await fetch(
            `/api/movies/discover?genreId=${selectedGenre}&page=${currentPage}`
          );
          const data = await response.json();

          if (!response.ok) {
            throw new Error(data.error || "Failed to discover movies");
          }

          setMovies(data.movies || []);
          setTotalPages(data.totalPages || 0);
        } catch (error) {
          console.error("Error loading movies:", error);
          toast.error(
            error instanceof Error ? error.message : "Failed to load movies"
          );
        } finally {
          setLoading(false);
        }
      };
      loadMovies();
    }
  }, [currentPage, searchMode, selectedGenre]);

  const searchMovies = async () => {
    if (searchMode === "text" && !searchQuery.trim()) return;
    if (searchMode === "genre" && !selectedGenre) return;

    setLoading(true);
    try {
      let response: Response;
      let data: any;

      if (searchMode === "text") {
        response = await fetch(
          `/api/movies/search?q=${encodeURIComponent(searchQuery)}`
        );
        data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to search movies");
        }

        setMovies(data.movies || []);
        setTotalPages(0);
      } else {
        response = await fetch(
          `/api/movies/discover?genreId=${selectedGenre}&page=${currentPage}`
        );
        data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to discover movies");
        }

        setMovies(data.movies || []);
        setTotalPages(data.totalPages || 0);
      }
    } catch (error) {
      console.error("Error searching movies:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to search movies"
      );
    } finally {
      setLoading(false);
    }
  };

  const voteOnMovie = async (
    movie: Movie,
    vote: "upvote" | "downvote" | "neutral"
  ) => {
    try {
      const response = await fetch("/api/movies/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tmdbId: movie.id.toString(),
          title: movie.title,
          overview: movie.overview,
          posterPath: movie.poster_path,
          releaseDate: movie.release_date,
          voteAverage: movie.vote_average,
          genreIds: movie.genre_ids,
          vote,
        }),
      });

      if (!response.ok) throw new Error("Failed to vote on movie");

      setUserVotes((prev) => ({
        ...prev,
        [movie.id]: vote,
      }));

      toast.success(`Voted ${vote} on ${movie.title}`);
    } catch (error) {
      console.error("Error voting on movie:", error);
      toast.error("Failed to vote on movie");
    }
  };

  const compareVotes = async () => {
    if (!selectedFriend) return;

    try {
      const response = await fetch(
        `/api/movies/votes?friendId=${selectedFriend}`
      );
      if (!response.ok) throw new Error("Failed to get comparison data");

      const data = await response.json();
      setComparisonData(data);
    } catch (error) {
      console.error("Error comparing votes:", error);
      toast.error("Failed to compare votes");
    }
  };

  const getVoteButtonStyle = (movieId: number, voteType: string) => {
    const currentVote = userVotes[movieId];
    if (currentVote === voteType) {
      return "bg-green-500 text-white hover:bg-green-600";
    }
    return "bg-gray-200 text-gray-700 hover:bg-gray-300";
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Movie Voting</h1>
        <p className="text-gray-600">
          Search for movies and vote on them with your friends
        </p>
      </div>

      {/* Search Section */}
      <div className="mb-8">
        {/* Search Mode Toggle */}
        <div className="flex gap-2 mb-4">
          <Button
            onClick={() => {
              setSearchMode("text");
              setSelectedGenre(null);
              setMovies([]);
              setCurrentPage(1);
            }}
            className={`px-4 py-2 rounded-lg ${
              searchMode === "text"
                ? "bg-indigo-600 text-white"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
          >
            Search by Title
          </Button>
          <Button
            onClick={() => {
              setSearchMode("genre");
              setSearchQuery("");
              setMovies([]);
              setCurrentPage(1);
            }}
            className={`px-4 py-2 rounded-lg ${
              searchMode === "genre"
                ? "bg-indigo-600 text-white"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
          >
            Browse by Genre
          </Button>
        </div>

        {searchMode === "text" ? (
          <div className="flex gap-4 mb-4">
            <input
              type="text"
              placeholder="Search for movies..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && searchMovies()}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <Button
              onClick={searchMovies}
              disabled={loading}
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? "Searching..." : "Search"}
            </Button>
          </div>
        ) : (
          <div className="flex gap-4 mb-4">
            <select
              value={selectedGenre || ""}
              onChange={(e) =>
                setSelectedGenre(e.target.value ? Number(e.target.value) : null)
              }
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Select a genre...</option>
              {genres.map((genre) => (
                <option key={genre.id} value={genre.id}>
                  {genre.name}
                </option>
              ))}
            </select>
            <Button
              onClick={searchMovies}
              disabled={loading || !selectedGenre}
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? "Loading..." : "Browse"}
            </Button>
          </div>
        )}
      </div>

      {/* Friend Comparison Section */}
      <div className="mb-8 p-4 bg-gray-50 rounded-lg">
        <h2 className="text-xl font-semibold mb-4">
          Compare Votes with Friends
        </h2>
        <div className="flex gap-4 items-center">
          <select
            value={selectedFriend || ""}
            onChange={(e) => setSelectedFriend(e.target.value || null)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Select a friend...</option>
            {friends.map((friend) => (
              <option key={friend.id} value={friend.id}>
                {friend.name}
              </option>
            ))}
          </select>
          <Button
            onClick={compareVotes}
            disabled={!selectedFriend}
            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            Compare Votes
          </Button>
        </div>

        {comparisonData && (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-lg border">
              <h3 className="font-semibold text-green-600 mb-2">
                Both Upvoted ({comparisonData.bothUpvoted.length})
              </h3>
              {comparisonData.bothUpvoted.map((movie: any) => (
                <div key={movie.id} className="text-sm text-gray-600 mb-1">
                  {movie.title}
                </div>
              ))}
            </div>
            <div className="bg-white p-4 rounded-lg border">
              <h3 className="font-semibold text-blue-600 mb-2">
                You Upvoted ({comparisonData.userUpvoted.length})
              </h3>
              {comparisonData.userUpvoted.map((movie: any) => (
                <div key={movie.id} className="text-sm text-gray-600 mb-1">
                  {movie.title}
                </div>
              ))}
            </div>
            <div className="bg-white p-4 rounded-lg border">
              <h3 className="font-semibold text-purple-600 mb-2">
                Friend Upvoted ({comparisonData.friendUpvoted.length})
              </h3>
              {comparisonData.friendUpvoted.map((movie: any) => (
                <div key={movie.id} className="text-sm text-gray-600 mb-1">
                  {movie.title}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Movies Grid */}
      {movies.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {movies.map((movie) => (
            <div
              key={movie.id}
              className="bg-white rounded-lg shadow-md overflow-hidden"
            >
              {movie.poster_path ? (
                <img
                  src={`https://image.tmdb.org/t/p/w500${movie.poster_path}`}
                  alt={movie.title}
                  className="w-full h-64 object-cover"
                />
              ) : (
                <div className="w-full h-64 bg-gray-200 flex items-center justify-center">
                  <Icons.Film className="h-12 w-12 text-gray-400" />
                </div>
              )}
              <div className="p-4">
                <h3 className="font-semibold text-lg mb-2 line-clamp-2">
                  {movie.title}
                </h3>
                <p className="text-sm text-gray-600 mb-2 line-clamp-3">
                  {movie.overview}
                </p>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-gray-500">
                    {movie.release_date?.split("-")[0]}
                  </span>
                  <span className="text-sm font-medium">
                    ⭐ {movie.vote_average}
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => voteOnMovie(movie, "upvote")}
                    className={`flex-1 py-1 text-sm ${getVoteButtonStyle(
                      movie.id,
                      "upvote"
                    )}`}
                  >
                    👍 Upvote
                  </Button>
                  <Button
                    onClick={() => voteOnMovie(movie, "downvote")}
                    className={`flex-1 py-1 text-sm ${getVoteButtonStyle(
                      movie.id,
                      "downvote"
                    )}`}
                  >
                    👎 Downvote
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {movies.length === 0 &&
        !loading &&
        ((searchMode === "text" && searchQuery) ||
          (searchMode === "genre" && selectedGenre)) && (
          <div className="text-center py-12">
            <Icons.Film className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">
              {searchMode === "text"
                ? `No movies found for "${searchQuery}"`
                : "No movies found for this genre"}
            </p>
          </div>
        )}

      {/* Pagination for Genre Browse */}
      {searchMode === "genre" && totalPages > 1 && (
        <div className="flex justify-center items-center gap-4 mt-8">
          <Button
            onClick={() => {
              setCurrentPage((prev) => Math.max(1, prev - 1));
            }}
            disabled={currentPage === 1}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:opacity-50"
          >
            Previous
          </Button>
          <span className="text-gray-600">
            Page {currentPage} of {totalPages}
          </span>
          <Button
            onClick={() => {
              setCurrentPage((prev) => Math.min(totalPages, prev + 1));
            }}
            disabled={currentPage === totalPages}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:opacity-50"
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
