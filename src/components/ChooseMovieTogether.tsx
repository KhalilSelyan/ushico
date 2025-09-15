/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useState } from "react";
import { Icons } from "@/components/Icons";
import { Button } from "@/components/ui/button";

interface Movie {
  id: number;
  title: string;
  overview: string;
  poster_path: string;
  release_date: string;
  vote_average: number;
  genre_ids: number[];
  genre_name: string;
}

interface GenreSuggestion {
  genre: string;
  genre_id: number;
  movies: Movie[];
}

interface ChooseMovieTogetherProps {
  friendId: string;
  friendName: string;
  onClose: () => void;
}

export default function ChooseMovieTogether({
  friendId,
  friendName,
  onClose,
}: ChooseMovieTogetherProps) {
  const [suggestions, setSuggestions] = useState<GenreSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMovies, setSelectedMovies] = useState<Set<number>>(new Set());
  const [step, setStep] = useState<"selecting" | "results">("selecting");
  const [bothSelectedMovies, setBothSelectedMovies] = useState<Movie[]>([]);
  const [finalChoice, setFinalChoice] = useState<Movie | null>(null);

  useEffect(() => {
    const loadSuggestions = async () => {
      try {
        const response = await fetch(
          `/api/movies/suggestions?friendId=${friendId}`
        );
        if (!response.ok) throw new Error("Failed to load suggestions");

        const data = await response.json();
        setSuggestions(data.suggestions || []);
      } catch (error) {
        console.error("Error loading suggestions:", error);
      } finally {
        setLoading(false);
      }
    };

    loadSuggestions();
  }, [friendId]);

  const toggleMovieSelection = (movieId: number) => {
    setSelectedMovies((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(movieId)) {
        newSet.delete(movieId);
      } else {
        newSet.add(movieId);
      }
      return newSet;
    });
  };

  const submitSelections = async () => {
    if (selectedMovies.size === 0) return;

    try {
      // Vote on all selected movies
      const votePromises = Array.from(selectedMovies).map(async (movieId) => {
        const movie = suggestions
          .flatMap((s) => s.movies)
          .find((m) => m.id === movieId);

        if (!movie) return;

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
            vote: "upvote",
          }),
        });

        return response.ok;
      });

      await Promise.all(votePromises);

      // Get comparison data to see what both users selected
      const comparisonResponse = await fetch(
        `/api/movies/votes?friendId=${friendId}`
      );
      if (comparisonResponse.ok) {
        const comparisonData = await comparisonResponse.json();
        setBothSelectedMovies(comparisonData.bothUpvoted || []);
      }

      setStep("results");
    } catch (error) {
      console.error("Error submitting selections:", error);
    }
  };

  const makeFinalChoice = (movie: Movie) => {
    setFinalChoice(movie);
    // Here you could add logic to notify the friend or save the final choice
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8 max-w-2xl w-full mx-4">
          <div className="text-center">
            <Icons.Film className="h-12 w-12 text-indigo-600 mx-auto mb-4 animate-pulse" />
            <h2 className="text-xl font-semibold mb-2">
              Loading Movie Suggestions
            </h2>
            <p className="text-gray-600">
              Finding the perfect movies for you and {friendName}...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (step === "results") {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900">
              🎬 Movie Selection Results
            </h2>
            <Button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700"
            >
              <Icons.X className="h-6 w-6" />
            </Button>
          </div>

          {bothSelectedMovies.length > 0 ? (
            <div>
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-green-600 mb-2">
                  🎉 Movies You Both Like ({bothSelectedMovies.length})
                </h3>
                <p className="text-gray-600">
                  These are the movies you and {friendName} both selected. Pick
                  one to watch together!
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                {bothSelectedMovies.map((movie) => (
                  <button
                    type="button"
                    key={movie.id}
                    className={`bg-white rounded-lg shadow-md overflow-hidden border-2 cursor-pointer transition-all ${
                      finalChoice?.id === movie.id
                        ? "border-green-500 shadow-lg"
                        : "border-gray-200 hover:border-indigo-300"
                    }`}
                    onClick={() => makeFinalChoice(movie)}
                  >
                    {movie.poster_path ? (
                      <img
                        src={`https://image.tmdb.org/t/p/w500${movie.poster_path}`}
                        alt={movie.title}
                        className="w-full h-48 object-cover"
                      />
                    ) : (
                      <div className="w-full h-48 bg-gray-200 flex items-center justify-center">
                        <Icons.Film className="h-12 w-12 text-gray-400" />
                      </div>
                    )}
                    <div className="p-4">
                      <h4 className="font-semibold text-lg mb-2 line-clamp-2">
                        {movie.title}
                      </h4>
                      <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                        {movie.overview}
                      </p>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500">
                          {movie.release_date?.split("-")[0]}
                        </span>
                        <span className="text-sm font-medium">
                          ⭐ {movie.vote_average}
                        </span>
                      </div>
                      {finalChoice?.id === movie.id && (
                        <div className="mt-2 text-center">
                          <span className="inline-block bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">
                            🎯 Your Choice!
                          </span>
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>

              {finalChoice && (
                <div className="text-center">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                    <h4 className="text-lg font-semibold text-green-800 mb-2">
                      🎬 You&apos;ve chosen to watch:
                    </h4>
                    <p className="text-xl font-bold text-green-900">
                      {finalChoice.title}
                    </p>
                  </div>
                  <Button
                    onClick={onClose}
                    className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700"
                  >
                    Start Watching!
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8">
              <Icons.Film className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                No Common Choices
              </h3>
              <p className="text-gray-600 mb-4">
                You and {friendName} didn&apos;t select any of the same movies.
                Try again with different selections!
              </p>
              <Button
                onClick={() => setStep("selecting")}
                className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700"
              >
                Try Again
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-8 max-w-6xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              🎬 Choose Movies Together
            </h2>
            <p className="text-gray-600">
              Select movies you&apos;d like to watch with {friendName}
            </p>
          </div>
          <Button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <Icons.X className="h-6 w-6" />
          </Button>
        </div>

        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">
              Selected: {selectedMovies.size} movies
            </h3>
            <Button
              onClick={submitSelections}
              disabled={selectedMovies.size === 0}
              className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              Submit Selections
            </Button>
          </div>
        </div>

        <div className="space-y-8">
          {suggestions.map((genreSuggestion) => (
            <div
              key={genreSuggestion.genre_id}
              className="border border-gray-200 rounded-lg p-6"
            >
              <h3 className="text-xl font-semibold text-gray-900 mb-4">
                🎭 {genreSuggestion.genre}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                {genreSuggestion.movies.map((movie) => (
                  <button
                    type="button"
                    key={movie.id}
                    className={`bg-white rounded-lg shadow-md overflow-hidden border-2 cursor-pointer transition-all ${
                      selectedMovies.has(movie.id)
                        ? "border-indigo-500 shadow-lg"
                        : "border-gray-200 hover:border-indigo-300"
                    }`}
                    onClick={() => toggleMovieSelection(movie.id)}
                  >
                    {movie.poster_path ? (
                      <img
                        src={`https://image.tmdb.org/t/p/w500${movie.poster_path}`}
                        alt={movie.title}
                        className="w-full h-32 object-cover"
                      />
                    ) : (
                      <div className="w-full h-32 bg-gray-200 flex items-center justify-center">
                        <Icons.Film className="h-8 w-8 text-gray-400" />
                      </div>
                    )}
                    <div className="p-3">
                      <h4 className="font-semibold text-sm mb-1 line-clamp-2">
                        {movie.title}
                      </h4>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-500">
                          {movie.release_date?.split("-")[0]}
                        </span>
                        <span className="font-medium">
                          ⭐ {movie.vote_average}
                        </span>
                      </div>
                      {selectedMovies.has(movie.id) && (
                        <div className="mt-2 text-center">
                          <span className="inline-block bg-indigo-100 text-indigo-800 text-xs px-2 py-1 rounded-full">
                            ✓ Selected
                          </span>
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
