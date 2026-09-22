/**
 * Page-source capture for failure diagnostics — the reporter hook
 * (framework/hooks/reporterHooks.js) already screenshots on any thrown
 * error; this adds the matching page-source dump into the same directory
 * so a failure has both artifacts side by side.
 */
import fs from 'node:fs';
import path from 'node:path';
import { clientLog } from './clientLog';

export async function dumpPageSource(label: string): Promise<string | null> {
  try {
    const src = await browser.getPageSource();
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const safeName = label.replace(/[^a-z0-9-_]+/gi, '_').slice(0, 80);
    const dir = path.join(__dirname, '..', 'screenshots');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const filePath = path.join(dir, `${safeName}_${stamp}.xml`);
    fs.writeFileSync(filePath, src);
    clientLog(`Page source captured: ${filePath}`);
    return filePath;
  } catch (err) {
    clientLog(`Could not capture page source: ${String(err)}`);
    return null;
  }
}
