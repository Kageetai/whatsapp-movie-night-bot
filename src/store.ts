import * as fs from 'fs';
import * as path from 'path';
import { Suggestion, PendingSuggestion, Movie } from './types';

const DATA_DIR = path.join(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'suggestions.json');

interface PersistedData {
  suggestions: [string, Suggestion][];
  locked: boolean;
}

class SuggestionStore {
  private suggestions: Map<string, Suggestion> = new Map();
  private pendingSuggestions: Map<string, PendingSuggestion> = new Map();
  private locked: boolean = false;

  load(): void {
    try {
      if (!fs.existsSync(DATA_FILE)) {
        return;
      }

      const raw = fs.readFileSync(DATA_FILE, 'utf-8');
      const data: PersistedData = JSON.parse(raw);

      this.suggestions = new Map(
        data.suggestions.map(([key, suggestion]) => [
          key,
          { ...suggestion, timestamp: new Date(suggestion.timestamp) },
        ])
      );
      this.locked = data.locked;

      console.log(`Loaded ${this.suggestions.size} suggestions from storage`);
    } catch (error) {
      console.error('Failed to load suggestions from storage:', error);
    }
  }

  private save(): void {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }

      const data: PersistedData = {
        suggestions: Array.from(this.suggestions.entries()),
        locked: this.locked,
      };

      fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Failed to save suggestions to storage:', error);
    }
  }

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
    this.save();
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
    this.save();
  }

  unlock(): void {
    this.locked = false;
    this.save();
  }

  reset(): void {
    this.suggestions.clear();
    this.pendingSuggestions.clear();
    this.locked = false;
    this.save();
  }
}

export const store = new SuggestionStore();
