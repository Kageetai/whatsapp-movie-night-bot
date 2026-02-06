import { CommandResponse } from '../types';
import { getTMDB } from '../services/tmdb';
import { store } from '../store';

export async function suggestCommand(
  args: string,
  senderJid: string,
  senderName: string
): Promise<CommandResponse> {
  if (store.isLocked()) {
    return {
      text: 'Suggestions are currently locked. They will reopen Saturday at midnight.',
    };
  }

  const movieTitle = args.trim();

  if (!movieTitle) {
    return {
      text: 'Please provide a movie title. Example: /suggest Inception',
    };
  }

  try {
    const tmdb = getTMDB();
    const movie = await tmdb.searchMovie(movieTitle);

    if (!movie) {
      return {
        text: `Could not find a movie matching "${movieTitle}". Try a different search term.`,
      };
    }

    const existingSuggestion = store.getSuggestion(senderJid);
    store.addSuggestion(movie, senderJid, senderName);

    let response = `*${movie.title}* (${movie.year}) ⭐ ${movie.rating}
${movie.overview}

✅ Added to this week's suggestions!`;

    if (existingSuggestion) {
      response += `\n(Replaced: ${existingSuggestion.movie.title})`;
    }

    if (movie.imdbUrl) {
      response += `\n\n${movie.imdbUrl}`;
    }

    return {
      text: response,
      imageUrl: movie.posterUrl || undefined,
    };
  } catch (error) {
    if (error instanceof Error && error.message.includes('locked')) {
      return {
        text: 'Suggestions are currently locked. They will reopen Saturday at midnight.',
      };
    }
    console.error('Suggest command error:', error);
    return {
      text: 'Sorry, there was an error searching for that movie. Please try again.',
    };
  }
}
