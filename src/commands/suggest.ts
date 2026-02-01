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
      text: 'Please provide a movie title. Example: !suggest Inception',
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

    store.setPendingSuggestion(movie, senderJid, senderName);

    const response = `Found: *${movie.title}* (${movie.year}) ⭐ ${movie.rating}
${movie.overview}

Reply "yes" to confirm or "!suggest <different movie>" to try again.`;

    return {
      text: response,
      imageUrl: movie.posterUrl || undefined,
    };
  } catch (error) {
    console.error('Suggest command error:', error);
    return {
      text: 'Sorry, there was an error searching for that movie. Please try again.',
    };
  }
}

export async function handleConfirmation(
  senderJid: string,
  senderName: string
): Promise<CommandResponse | null> {
  const pending = store.getPendingSuggestion(senderJid);

  if (!pending) {
    return null;
  }

  const existingSuggestion = store.getSuggestion(senderJid);

  try {
    store.addSuggestion(pending.movie, senderJid, senderName);

    let text = `*${pending.movie.title}* (${pending.movie.year}) has been added to this week's suggestions!`;

    if (existingSuggestion) {
      text += `\n\n(Replaced your previous suggestion: ${existingSuggestion.movie.title})`;
    }

    if (pending.movie.imdbUrl) {
      text += `\n\n${pending.movie.imdbUrl}`;
    }

    return { text };
  } catch (error) {
    if (error instanceof Error && error.message.includes('locked')) {
      return {
        text: 'Suggestions are currently locked. They will reopen Saturday at midnight.',
      };
    }
    throw error;
  }
}
