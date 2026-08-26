const suppressedInfoMessages = new Set([
  'Opening session:',
  'Closing session:',
]);

const suppressedWarningMessages = new Set([
  'Session already open',
  'Session already closed',
]);

let signalLogFilterInstalled = false;

export function suppressSignalSessionLogs(): void {
  if (signalLogFilterInstalled) return;
  signalLogFilterInstalled = true;

  const originalInfo = console.info;
  const originalWarn = console.warn;

  console.info = (...args: unknown[]) => {
    if (suppressedInfoMessages.has(String(args[0]))) return;
    originalInfo.apply(console, args);
  };

  console.warn = (...args: unknown[]) => {
    if (suppressedWarningMessages.has(String(args[0]))) return;
    originalWarn.apply(console, args);
  };
}
