/**
 * Client-friendly progress lines for the Control Desk “Client” log view.
 *
 * Prints `console.log('[CLIENT] …')` so the dashboard can filter these lines
 * when showing a layman / demo view, while Full log still shows everything.
 *
 * @example
 * clientLog('Email has been entered');
 */
export function clientLog(message: string): void {
  const text = String(message || '').trim();
  if (!text) return;
  // Prefix must stay stable — dashboard filters on `[CLIENT]`
  console.log(`[CLIENT] ${text}`);
}

/**
 * Mark the start of a named test / flow for clients.
 */
export function clientStep(title: string): void {
  clientLog(`— ${title} —`);
}
