import axios from 'axios';
import { Movie, TMDBSearchResult, TMDBMovieDetails } from '../types';

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

export class TMDBService {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async searchMovie(query: string): Promise<Movie | null> {
    try {
      const searchResponse = await axios.get<{ results: TMDBSearchResult[] }>(
        `${TMDB_BASE_URL}/search/movie`,
        {
          params: {
            api_key: this.apiKey,
            query,
            include_adult: false,
            language: 'en-US',
          },
        }
      );

      const results = searchResponse.data.results;
      if (results.length === 0) {
        return null;
      }

      const bestMatch = results[0];
      const details = await this.getMovieDetails(bestMatch.id);

      return details;
    } catch (error) {
      console.error('TMDB search error:', error);
      throw new Error('Failed to search for movie');
    }
  }

  private async getMovieDetails(movieId: number): Promise<Movie> {
    const response = await axios.get<TMDBMovieDetails>(
      `${TMDB_BASE_URL}/movie/${movieId}`,
      {
        params: {
          api_key: this.apiKey,
          language: 'en-US',
        },
      }
    );

    const movie = response.data;
    const year = movie.release_date
      ? parseInt(movie.release_date.split('-')[0], 10)
      : 0;

    return {
      id: movie.id,
      title: movie.title,
      year,
      rating: Math.round(movie.vote_average * 10) / 10,
      overview: this.truncateOverview(movie.overview),
      posterUrl: movie.poster_path
        ? `${TMDB_IMAGE_BASE_URL}${movie.poster_path}`
        : null,
      imdbId: movie.imdb_id,
      imdbUrl: movie.imdb_id
        ? `https://www.imdb.com/title/${movie.imdb_id}/`
        : null,
    };
  }

  private truncateOverview(overview: string, maxLength: number = 200): string {
    if (overview.length <= maxLength) {
      return overview;
    }
    return overview.substring(0, maxLength).trim() + '...';
  }
}

let tmdbService: TMDBService | null = null;

export function initTMDB(apiKey: string): TMDBService {
  tmdbService = new TMDBService(apiKey);
  return tmdbService;
}

export function getTMDB(): TMDBService {
  if (!tmdbService) {
    throw new Error('TMDB service not initialized');
  }
  return tmdbService;
}
