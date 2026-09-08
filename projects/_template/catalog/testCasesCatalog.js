/**
 * Test catalog for HTML reports — extend as you add cases.
 */
module.exports = {
  suites: [
    {
      id: 'smoke',
      name: 'Smoke',
      cases: [
        {
          id: 'SM-001',
          title: 'Launch session smoke',
          type: 'smoke',
        },
      ],
    },
  ],
};
