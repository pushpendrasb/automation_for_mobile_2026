/**
 * Ambient stubs for the bare TypeScript template (no node_modules).
 * After `npm install` in a real project, prefer package types from
 * @wdio/globals / expect-webdriverio (see tsconfig "types" in scaffolded apps).
 */
declare const browser: WebdriverIO.Browser;
declare const driver: WebdriverIO.Browser;
declare const expect: ExpectWebdriverIO.Expect;

declare namespace WebdriverIO {
  // Minimal shape so template smoke tests typecheck without deps installed.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  interface Browser {
    pause(ms: number): Promise<void>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    capabilities: Record<string, any>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    execute(script: string, ...args: any[]): Promise<any>;
    getCurrentPackage(): Promise<string>;
  }
}

declare namespace ExpectWebdriverIO {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type Expect = (actual: any) => any;
}

declare function describe(name: string, fn: () => void): void;
declare function it(
  name: string,
  fn: () => void | Promise<void>,
): void;
