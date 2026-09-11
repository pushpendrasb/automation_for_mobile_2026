/**
 * Test credentials and helpers for Appraisee IE automation.
 * Reads TEST_USER / TEST_PASSWORD from projects/appraiseeie/.env
 */
export const testData = {
  get email(): string {
    return (process.env.TEST_USER || '').trim();
  },
  get password(): string {
    return (process.env.TEST_PASSWORD || '').trim();
  },
  /** Role row to tap after login (0 = first dealer/role). Override with APPRAISEE_ROLE_INDEX. */
  get roleIndex(): number {
    const raw = (process.env.APPRAISEE_ROLE_INDEX || '0').trim();
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  },
};

/**
 * Ensure credentials exist before a positive login run.
 */
export function assertCredentialsConfigured(): void {
  if (!testData.email || !testData.password) {
    throw new Error(
      'Set TEST_USER and TEST_PASSWORD in projects/appraiseeie/.env before running login tests.',
    );
  }
}
