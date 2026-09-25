/**
 * Release Checklist module for Automation Control Desk.
 * Shared template + per-project persistence + export APIs.
 */
module.exports = {
  createReleaseChecklistApi: require('./api').createReleaseChecklistApi,
  createReleaseChecklistStore: require('./store').createReleaseChecklistStore,
  template: require('./template'),
  export: require('./export'),
};
