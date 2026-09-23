export interface TestExtraFields {
  expectedError?: string;
  actualError?: string;
  pageContext?: string;
  action?: string;
  [key: string]: unknown;
}

export function setTestExtras(fields: TestExtraFields): void;
export function takeTestExtras(): TestExtraFields;
