module.exports = {
  createWdioConfig: require('./config/createWdioConfig').createWdioConfig,
  buildIosCapabilities: require('./config/ios.config').buildIosCapabilities,
  buildAndroidCapabilities: require('./config/android.config').buildAndroidCapabilities,
  buildReporterHooks: require('./hooks/reporterHooks').buildReporterHooks,
  createTestReport: require('./utils/testReport').createTestReport,
};
