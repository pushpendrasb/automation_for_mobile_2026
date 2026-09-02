/**
 * @typedef {Object} ProjectConfig
 * @property {string} projectId
 * @property {string} displayName
 * @property {string} rootDir
 * @property {string} catalogPath Absolute path to testCasesCatalog.js
 * @property {string} reportsDir
 * @property {string} screenshotsDir
 * @property {string} reportBaseName Base filename without extension (e.g. roskids-report)
 * @property {string} [junitFile] JUnit XML filename
 * @property {string[]} specs Glob paths relative to rootDir
 * @property {number} [mochaTimeout]
 * @property {{ ios?: { bundleId?: string }, android?: { appPackage?: string } }} [defaults]
 */

module.exports = {};
