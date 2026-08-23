import cron, { ScheduledTask } from 'node-cron';
import { store } from '../store';

export interface SchedulerConfig {
  timezone: string;
  deadlineDay: number;
  deadlineHour: number;
}

const REMINDER_WINDOW_MS = 24 * 60 * 60 * 1000;

interface ReminderStore {
  getSuggestionCount(): number;
  wasReminderSentFor(deadline: Date): boolean;
  markReminderSentFor(deadline: Date): void;
}

export class Scheduler {
  private config: SchedulerConfig;
  private reminderStore: ReminderStore;
  private pollCallback: (() => Promise<void>) | null = null;
  private reminderCallback: (() => Promise<void>) | null = null;
  private cronJob: ScheduledTask | null = null;
  private reminderCronJob: ScheduledTask | null = null;
  private resetCronJob: ScheduledTask | null = null;
  private reminderInProgress = false;

  constructor(config: SchedulerConfig, reminderStore: ReminderStore = store) {
    this.config = config;
    this.reminderStore = reminderStore;
  }

  onPollTime(callback: () => Promise<void>): void {
    this.pollCallback = callback;
  }

  onReminderTime(callback: () => Promise<void>): void {
    this.reminderCallback = callback;
  }

  async checkReminder(now = new Date()): Promise<void> {
    if (!this.reminderCallback || this.reminderInProgress) return;

    const deadline = this.getNextDeadline(now);
    const timeUntilDeadline = deadline.getTime() - now.getTime();
    if (timeUntilDeadline <= 0 || timeUntilDeadline > REMINDER_WINDOW_MS) {
      return;
    }
    if (this.reminderStore.getSuggestionCount() > 0) return;
    if (this.reminderStore.wasReminderSentFor(deadline)) return;

    this.reminderInProgress = true;
    try {
      await this.reminderCallback();
      this.reminderStore.markReminderSentFor(deadline);
    } finally {
      this.reminderInProgress = false;
    }
  }

  start(): void {
    const { deadlineDay, deadlineHour, timezone } = this.config;

    const cronExpression = `0 ${deadlineHour} * * ${deadlineDay}`;

    this.cronJob = cron.schedule(
      cronExpression,
      async () => {
        console.log('Poll time triggered by scheduler');
        await this.triggerPoll();
      },
      {
        timezone,
      }
    );

    this.reminderCronJob = cron.schedule(
      '* * * * *',
      async () => {
        try {
          await this.checkReminder();
        } catch (error) {
          console.error('Failed to send suggestion reminder:', error);
        }
      },
      {
        timezone,
      }
    );

    const resetCronExpression = '0 0 * * 6';
    this.resetCronJob = cron.schedule(
      resetCronExpression,
      () => {
        console.log('Weekly reset triggered');
        this.reset();
      },
      {
        timezone,
      }
    );

    console.log(
      `Scheduler started: Poll at ${deadlineHour}:00 on day ${deadlineDay} (${timezone})`
    );
  }

  async triggerPoll(): Promise<void> {
    if (this.pollCallback) {
      store.lock();
      await this.pollCallback();
    }
  }

  reset(): void {
    store.reset();
    console.log('Suggestions reset for new week');
  }

  stop(): void {
    for (const job of [this.cronJob, this.reminderCronJob, this.resetCronJob]) {
      job?.stop();
    }
  }

  getNextDeadline(now = new Date()): Date {
    const { deadlineDay, deadlineHour, timezone } = this.config;

    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });

    const parts = formatter.formatToParts(now);
    const getPart = (formattedParts: Intl.DateTimeFormatPart[], type: string) =>
      formattedParts.find((part) => part.type === type)?.value || '0';

    const currentYear = parseInt(getPart(parts, 'year'), 10);
    const currentMonth = parseInt(getPart(parts, 'month'), 10) - 1;
    const currentDay = parseInt(getPart(parts, 'day'), 10);
    const currentHour = parseInt(getPart(parts, 'hour'), 10);
    const currentMinute = parseInt(getPart(parts, 'minute'), 10);

    // Keep the configured timezone's calendar fields in UTC-based accessors so
    // the server's own timezone cannot affect weekday/date arithmetic.
    const localNow = new Date(Date.UTC(
      currentYear,
      currentMonth,
      currentDay,
      currentHour,
      currentMinute
    ));
    const currentDayOfWeek = localNow.getUTCDay();

    let daysUntilDeadline = deadlineDay - currentDayOfWeek;
    if (daysUntilDeadline < 0) {
      daysUntilDeadline += 7;
    } else if (daysUntilDeadline === 0) {
      if (
        currentHour > deadlineHour ||
        (currentHour === deadlineHour && currentMinute > 0)
      ) {
        daysUntilDeadline = 7;
      }
    }

    const deadline = new Date(localNow);
    deadline.setUTCDate(localNow.getUTCDate() + daysUntilDeadline);
    deadline.setUTCHours(deadlineHour, 0, 0, 0);

    // Convert the target wall-clock time in `timezone` to a real instant.
    const targetWallTime = deadline.getTime();
    let candidateTime = targetWallTime;
    for (let attempt = 0; attempt < 3; attempt++) {
      const candidateParts = formatter.formatToParts(new Date(candidateTime));
      const representedWallTime = Date.UTC(
        parseInt(getPart(candidateParts, 'year'), 10),
        parseInt(getPart(candidateParts, 'month'), 10) - 1,
        parseInt(getPart(candidateParts, 'day'), 10),
        parseInt(getPart(candidateParts, 'hour'), 10),
        parseInt(getPart(candidateParts, 'minute'), 10)
      );
      const correction = targetWallTime - representedWallTime;
      candidateTime += correction;
      if (correction === 0) break;
    }

    return new Date(candidateTime);
  }

  getTimeUntilDeadline(): string {
    const now = new Date();
    const deadline = this.getNextDeadline();

    const diffMs = deadline.getTime() - now.getTime();
    if (diffMs <= 0) {
      return 'Poll time!';
    }

    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(
      (diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
    );
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    const parts: string[] = [];
    if (diffDays > 0) parts.push(`${diffDays}d`);
    if (diffHours > 0) parts.push(`${diffHours}h`);
    if (diffMinutes > 0) parts.push(`${diffMinutes}m`);

    return parts.join(' ') || 'Less than a minute';
  }

  getDeadlineString(): string {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayName = days[this.config.deadlineDay];
    return `${dayName} ${this.config.deadlineHour}:00 CET`;
  }
}

let scheduler: Scheduler | null = null;

export function initScheduler(config: SchedulerConfig): Scheduler {
  scheduler = new Scheduler(config);
  return scheduler;
}

export function getScheduler(): Scheduler {
  if (!scheduler) {
    throw new Error('Scheduler not initialized');
  }
  return scheduler;
}
