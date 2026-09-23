const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const project = require('./project.config');
const { createWdioConfig } = require('@mobile-automation/appium-core/config/createWdioConfig');

process.env.AUTOMATION_PROJECT_ROOT = project.rootDir;

exports.config = createWdioConfig('android', project);
