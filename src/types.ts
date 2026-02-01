export interface Movie {
  id: number;
  title: string;
  year: number;
  rating: number;
  overview: string;
  posterUrl: string | null;
  imdbId: string | null;
  imdbUrl: string | null;
}

export interface Suggestion {
  movie: Movie;
  suggestedBy: string;
  suggestedByJid: string;
  timestamp: Date;
}

export interface PendingSuggestion {
  movie: Movie;
  userJid: string;
  userName: string;
  expiresAt: Date;
}

export interface Config {
  tmdbApiKey: string;
  groupJid: string;
  deadlineTimezone: string;
  deadlineDay: number;
  deadlineHour: number;
  port: number;
}

export interface TMDBSearchResult {
  id: number;
  title: string;
  release_date: string;
  vote_average: number;
  overview: string;
  poster_path: string | null;
}

export interface TMDBMovieDetails {
  id: number;
  title: string;
  release_date: string;
  vote_average: number;
  overview: string;
  poster_path: string | null;
  imdb_id: string | null;
}

export type CommandHandler = (
  args: string,
  senderJid: string,
  senderName: string
) => Promise<CommandResponse>;

export interface CommandResponse {
  text: string;
  imageUrl?: string;
}
