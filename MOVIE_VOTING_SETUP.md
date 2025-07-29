# Movie Voting Feature Setup

This guide explains how to set up the movie voting feature that allows users to search for movies, vote on them, and compare votes with their friends.

## Features

- **Movie Search**: Search for movies by title using The Movie Database (TMDB) API
- **Genre Browsing**: Browse movies by genre (Romance, Action, Comedy, etc.) with pagination
- **Interactive Movie Selection**: Choose movies together with friends in a guided, fun experience
- **Voting System**: Upvote or downvote movies
- **Friend Comparison**: Compare your votes with friends to find movies you both like
- **Vote Categories**:
  - Both Upvoted: Movies you and your friend both upvoted
  - You Upvoted: Movies only you upvoted
  - Friend Upvoted: Movies only your friend upvoted

## Setup Instructions

### 1. Get TMDB API Key

1. Go to [The Movie Database](https://www.themoviedb.org/)
2. Create an account or sign in
3. Go to your account settings
4. Navigate to the "API" section
5. Request an API key for "Developer" use
6. Copy your API key

### 2. Add Environment Variable

Add your TMDB API key to your `.env` file:

```env
TMDB_API_KEY=your_tmdb_api_key_here
```

### 3. Database Migration

Run the database migration to create the new tables:

```bash
pnpm db:generate
pnpm db:push
```

This will create:

- `movie_table`: Stores movie information from TMDB
- `movie_vote_table`: Stores user votes on movies

### 4. Access the Feature

1. Navigate to `/dashboard/movies` in your application
2. Use the search bar to find movies
3. Vote on movies using the upvote/downvote buttons
4. Select a friend from the dropdown to compare votes

## API Endpoints

### Search Movies

- **GET** `/api/movies/search?q={query}`
- Searches TMDB for movies matching the query

### Get Genres

- **GET** `/api/movies/genres`
- Returns available movie genres from TMDB

### Discover Movies by Genre

- **GET** `/api/movies/discover?genreId={genreId}&page={page}&sortBy={sortBy}`
- Returns movies filtered by genre with pagination

### Get Movie Suggestions

- **GET** `/api/movies/suggestions?friendId={friendId}`
- Returns curated movie suggestions for interactive selection

### Vote on Movie

- **POST** `/api/movies/vote`
- Body: `{ tmdbId, title, overview, posterPath, releaseDate, voteAverage, genreIds, vote }`
- Vote can be: "upvote", "downvote", or "neutral"

### Compare Votes

- **GET** `/api/movies/votes?friendId={friendId}`
- Returns categorized movie votes for comparison

## Database Schema

### Movie Table

```sql
CREATE TABLE movie_table (
  id TEXT PRIMARY KEY,
  tmdb_id TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  overview TEXT,
  poster_path TEXT,
  release_date TEXT,
  vote_average TEXT,
  genre_ids TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

### Movie Vote Table

```sql
CREATE TABLE movie_vote_table (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES user_table(id) ON DELETE CASCADE,
  movie_id TEXT NOT NULL REFERENCES movie_table(id) ON DELETE CASCADE,
  vote TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

## Usage

### Basic Movie Voting

1. **Search by Title**: Enter a movie title in the search bar and press Enter or click Search
2. **Browse by Genre**: Switch to "Browse by Genre" mode, select a genre, and browse through popular movies
3. **Vote on Movies**: Click the thumbs up (👍) or thumbs down (👎) buttons on any movie card
4. **Compare with Friends**: Select a friend from the dropdown and click "Compare Votes"
5. **View Results**: See categorized movies based on your voting patterns

### Interactive Movie Selection (New!)

1. **Start in Chat**: Click the 🎬 button in any chat with a friend
2. **Browse Suggestions**: View 5 curated movies from 5 different genres (Action, Comedy, Romance, Sci-Fi, Thriller)
3. **Select Favorites**: Click on movies you'd like to watch together
4. **Submit Selections**: Both users select their preferred movies
5. **See Results**: View movies you both selected and make a final choice
6. **Start Watching**: Pick your final movie and start watching together!

## Troubleshooting

- **No movies found**: Check your TMDB API key is correct and has proper permissions
- **Voting not working**: Ensure you're logged in and the database migration was successful
- **Friend comparison not working**: Make sure you have friends added to your account

## Future Enhancements

- Movie recommendations based on voting patterns
- Watchlist functionality
- Movie details page with more information
- Genre-based filtering
- Rating system (1-5 stars)
- Movie reviews and comments
