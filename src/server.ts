import express, { Request, Response } from 'express';
import { getScheduler } from './services/scheduler';
import { store } from './store';

export function createServer(port: number): express.Application {
  const app = express();

  app.get('/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      suggestions: store.getSuggestionCount(),
      locked: store.isLocked(),
    });
  });

  app.get('/trigger-poll', async (_req: Request, res: Response) => {
    try {
      const scheduler = getScheduler();
      await scheduler.triggerPoll();
      res.json({
        status: 'ok',
        message: 'Poll triggered',
      });
    } catch (error) {
      console.error('Poll trigger error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to trigger poll',
      });
    }
  });

  app.get('/status', (_req: Request, res: Response) => {
    try {
      const scheduler = getScheduler();
      res.json({
        status: 'ok',
        suggestions: store.getSuggestionCount(),
        locked: store.isLocked(),
        nextDeadline: scheduler.getNextDeadline().toISOString(),
        timeRemaining: scheduler.getTimeUntilDeadline(),
      });
    } catch {
      res.json({
        status: 'ok',
        suggestions: store.getSuggestionCount(),
        locked: store.isLocked(),
        error: 'Scheduler not initialized',
      });
    }
  });

  app.listen(port, () => {
    console.log(`Health check server listening on port ${port}`);
  });

  return app;
}
