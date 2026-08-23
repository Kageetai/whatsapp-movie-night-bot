const assert = require('node:assert/strict');
const Module = require('node:module');
const test = require('node:test');

function loadSchedulerWithFakeCron(t) {
  const originalLoad = Module._load;
  const scheduledJobs = [];

  Module._load = function loadWithFakeCron(request, parent, isMain) {
    if (request === 'node-cron') {
      return {
        __esModule: true,
        default: {
          schedule(expression, callback, options) {
            const job = { expression, callback, options, stopped: false };
            scheduledJobs.push(job);
            return {
              stop() {
                job.stopped = true;
              },
            };
          },
        },
      };
    }

    return originalLoad.call(this, request, parent, isMain);
  };

  const schedulerModulePath = require.resolve('../dist/services/scheduler.js');
  t.after(() => {
    Module._load = originalLoad;
    delete require.cache[schedulerModulePath];
  });

  return {
    Scheduler: require(schedulerModulePath).Scheduler,
    scheduledJobs,
  };
}

test('scheduler checks reminder eligibility every minute', async (t) => {
  const { Scheduler, scheduledJobs } = loadSchedulerWithFakeCron(t);
  const scheduler = new Scheduler({
    timezone: 'Europe/Berlin',
    deadlineDay: 5,
    deadlineHour: 18,
  });
  let reminderChecks = 0;
  scheduler.checkReminder = async () => {
    reminderChecks += 1;
  };

  scheduler.start();

  const reminderJob = scheduledJobs.find(
    ({ expression }) => expression === '* * * * *'
  );
  await reminderJob?.callback();

  assert.equal(reminderChecks, 1);
});

test('scheduler stop halts every scheduled job', (t) => {
  const { Scheduler, scheduledJobs } = loadSchedulerWithFakeCron(t);
  const scheduler = new Scheduler({
    timezone: 'Europe/Berlin',
    deadlineDay: 5,
    deadlineHour: 18,
  });

  scheduler.start();
  scheduler.stop();

  assert.equal(scheduledJobs.length, 3);
  assert.equal(scheduledJobs.every(({ stopped }) => stopped), true);
});
