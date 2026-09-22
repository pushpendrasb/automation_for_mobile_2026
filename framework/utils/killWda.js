#!/usr/bin/env node
/**
 * Finds and kills stuck WebDriverAgent-related processes (the
 * `xcodebuild test-without-building ... WebDriverAgentRunner` process Appium's
 * XCUITest driver keeps alive to reuse WDA across sessions). If that process
 * outlives a device going to sleep / losing UI-testing authorization, new
 * Appium sessions fail with "Not authorized for performing UI testing
 * actions." — killing it lets Appium spin up a fresh one on the next run.
 *
 * Usage: node ../../framework/utils/killWda.js [--list]
 *   --list   only print matching processes, don't kill anything
 */
const { execSync } = require('child_process');

const PATTERNS = [
  'WebDriverAgentRunner',
  'xcodebuild test-without-building',
];

function listMatches() {
  const out = execSync('ps -axo pid,etime,command', { encoding: 'utf8' });
  return out
    .split('\n')
    .slice(1)
    .filter((line) => line.trim())
    .filter((line) => PATTERNS.some((p) => line.includes(p)))
    .filter((line) => !line.includes('grep'))
    .map((line) => {
      const match = line.trim().match(/^(\d+)\s+(\S+)\s+(.*)$/);
      if (!match) return null;
      const [, pid, etime, command] = match;
      return { pid, etime, command };
    })
    .filter(Boolean);
}

function kill(pid) {
  try {
    process.kill(Number(pid), 'SIGTERM');
    return true;
  } catch (err) {
    console.error(`  Could not kill PID ${pid}: ${err.message}`);
    return false;
  }
}

const listOnly = process.argv.includes('--list');
const matches = listMatches();

if (matches.length === 0) {
  console.log('No WebDriverAgent / xcodebuild processes found.');
  process.exit(0);
}

console.log(`Found ${matches.length} WebDriverAgent process(es):\n`);
for (const { pid, etime, command } of matches) {
  console.log(`  PID ${pid}  (running ${etime})\n    ${command.slice(0, 160)}`);
}

if (listOnly) {
  process.exit(0);
}

console.log('\nKilling…');
let killed = 0;
for (const { pid } of matches) {
  if (kill(pid)) {
    console.log(`  Killed PID ${pid}`);
    killed++;
  }
}
console.log(`\nDone — ${killed}/${matches.length} process(es) killed.`);
console.log('Appium will start a fresh WebDriverAgent on the next test run.');
