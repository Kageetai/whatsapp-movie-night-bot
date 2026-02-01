import cron from 'node-cron';
import { store } from '../store';

export interface SchedulerConfig {
  timezone: string;
  deadlineDay: number;
  deadlineHour: number;
}

export class Scheduler {
  private config: SchedulerConfig;
  private pollCallback: (() => Promise<void>) | null = null;
  private cronJob: cron.ScheduledTask | null = null;

  constructor(config: SchedulerConfig) {
    this.config = config;
  }

  onPollTime(callback: () => Promise<void>): void {
    this.pollCallback = callback;
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
        scheduled: true,
      }
    );

    const resetCronExpression = '0 0 * * 6';
    cron.schedule(
      resetCronExpression,
      () => {
        console.log('Weekly reset triggered');
        this.reset();
      },
      {
        timezone,
        scheduled: true,
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
    if (this.cronJob) {
      this.cronJob.stop();
    }
  }

  getNextDeadline(): Date {
    const now = new Date();
    const { deadlineDay, deadlineHour, timezone } = this.config;

    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });

    const parts = formatter.formatToParts(now);
    const getPart = (type: string) =>
      parts.find((p) => p.type === type)?.value || '0';

    const currentYear = parseInt(getPart('year'), 10);
    const currentMonth = parseInt(getPart('month'), 10) - 1;
    const currentDay = parseInt(getPart('day'), 10);
    const currentHour = parseInt(getPart('hour'), 10);
    const currentMinute = parseInt(getPart('minute'), 10);

    const localNow = new Date(
      currentYear,
      currentMonth,
      currentDay,
      currentHour,
      currentMinute
    );
    const currentDayOfWeek = localNow.getDay();

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
    deadline.setDate(localNow.getDate() + daysUntilDeadline);
    deadline.setHours(deadlineHour, 0, 0, 0);

    return deadline;
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
