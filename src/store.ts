import { Suggestion, PendingSuggestion, Movie } from './types';

class SuggestionStore {
  private suggestions: Map<string, Suggestion> = new Map();
  private pendingSuggestions: Map<string, PendingSuggestion> = new Map();
  private locked: boolean = false;

  addSuggestion(
    movie: Movie,
    suggestedByJid: string,
    suggestedByName: string
  ): void {
    if (this.locked) {
      throw new Error('Suggestions are locked until the next cycle');
    }

    this.suggestions.set(suggestedByJid, {
      movie,
      suggestedBy: suggestedByName,
      suggestedByJid,
      timestamp: new Date(),
    });

    this.clearPendingSuggestion(suggestedByJid);
  }

  setPendingSuggestion(
    movie: Movie,
    userJid: string,
    userName: string
  ): void {
    if (this.locked) {
      throw new Error('Suggestions are locked until the next cycle');
    }

    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    this.pendingSuggestions.set(userJid, {
      movie,
      userJid,
      userName,
      expiresAt,
    });
  }

  getPendingSuggestion(userJid: string): PendingSuggestion | undefined {
    const pending = this.pendingSuggestions.get(userJid);
    if (pending && pending.expiresAt > new Date()) {
      return pending;
    }
    this.pendingSuggestions.delete(userJid);
    return undefined;
  }

  clearPendingSuggestion(userJid: string): void {
    this.pendingSuggestions.delete(userJid);
  }

  getSuggestion(userJid: string): Suggestion | undefined {
    return this.suggestions.get(userJid);
  }

  getAllSuggestions(): Suggestion[] {
    return Array.from(this.suggestions.values()).sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
    );
  }

  getSuggestionCount(): number {
    return this.suggestions.size;
  }

  isLocked(): boolean {
    return this.locked;
  }

  lock(): void {
    this.locked = true;
  }

  unlock(): void {
    this.locked = false;
  }

  reset(): void {
    this.suggestions.clear();
    this.pendingSuggestions.clear();
    this.locked = false;
  }
}

export const store = new SuggestionStore();
