import { Suggestion } from '../types';
import { store } from '../store';

export interface PollData {
  name: string;
  values: string[];
  selectableCount: number;
}

export interface PollMessages {
  introMessage: string;
  pollData: PollData;
}

export function createPollData(): PollMessages | null {
  const suggestions = store.getAllSuggestions();

  if (suggestions.length === 0) {
    return null;
  }

  const introLines = [
    "Time to vote! Here are this week's movies:",
    '',
  ];

  suggestions.forEach((suggestion, index) => {
    const { movie, suggestedBy } = suggestion;
    introLines.push(
      `${index + 1}. *${movie.title}* (${movie.year}) - suggested by ${suggestedBy}`
    );
    if (movie.imdbUrl) {
      introLines.push(`   ${movie.imdbUrl}`);
    }
    introLines.push('');
  });

  const pollOptions = suggestions.map((suggestion) => {
    const { movie } = suggestion;
    return `${movie.title} (${movie.year})`;
  });

  return {
    introMessage: introLines.join('\n'),
    pollData: {
      name: 'Which movie for tonight?',
      values: pollOptions,
      selectableCount: 1,
    },
  };
}

export function formatSuggestionsList(): string {
  const suggestions = store.getAllSuggestions();

  if (suggestions.length === 0) {
    return 'No suggestions yet. Use !suggest <movie title> to add one!';
  }

  const lines = [`Current suggestions (${suggestions.length}):`];

  suggestions.forEach((suggestion, index) => {
    const { movie, suggestedBy } = suggestion;
    lines.push(
      `${index + 1}. ${movie.title} (${movie.year}) - suggested by ${suggestedBy}`
    );
  });

  return lines.join('\n');
}

export function formatMovieCard(suggestion: Suggestion): string {
  const { movie, suggestedBy } = suggestion;
  const lines = [
    `*${movie.title}* (${movie.year}) ⭐ ${movie.rating}`,
    movie.overview,
    '',
    `Suggested by ${suggestedBy}`,
  ];

  if (movie.imdbUrl) {
    lines.push(movie.imdbUrl);
  }

  return lines.join('\n');
}
