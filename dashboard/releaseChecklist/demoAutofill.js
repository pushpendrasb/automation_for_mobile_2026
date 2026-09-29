/**
 * Realistic dummy answers for Release Checklist demo autofill.
 * Links use the reserved example domain. Nothing here is a real sign-off.
 */

/** Platform names filled only when that owner field is still blank. */
const DEMO_OWNERS = {
  backend: 'Aisha Khan',
  web: 'Rohit',
  ios: 'Pushpendra',
  android: 'Pritam',
  qa: 'Meera Shah',
};

/**
 * A few items stay open so a demo looks like a release in progress,
 * not a fully signed-off checklist.
 * @type {Record<string, { status: string, remarks: string, evidence?: string }>}
 */
const STORY = {
  'be-payments': {
    status: 'in_progress',
    remarks:
      'Live payment keys are in the vault. The webhook still points at the staging listener.',
  },
  'be-messaging': {
    status: 'in_progress',
    remarks: 'SMS sender ID is approved. The WhatsApp template is still in provider review.',
  },
  'web-fn-export': {
    status: 'blocked',
    remarks: 'CSV export times out above 5,000 owners. Tracked as DEMO-1842.',
    evidence: 'https://demo.example/release-checklist/web-fn-export',
  },
  'ios-review': {
    status: 'in_progress',
    remarks: 'Build 214 is in App Review. The QA TestFlight group already has it.',
  },
  'ios-released': {
    status: 'not_started',
    remarks: 'Phased App Store release waits until review finishes.',
  },
  'and-review': {
    status: 'blocked',
    remarks:
      'Play rejected the photo permission string. The policy fix is in the next AAB.',
    evidence: 'https://demo.example/release-checklist/and-review',
  },
  'and-released': {
    status: 'not_started',
    remarks: 'Production track is not rolled out while review is blocked.',
  },
  'sec-scan': {
    status: 'in_progress',
    remarks: 'Dependency scan is clean. The mobile binary scan is still running.',
    evidence: 'https://demo.example/release-checklist/sec-scan',
  },
  'qa-no-p1': {
    status: 'blocked',
    remarks: 'One P1 is open: animal photo upload fails on Android 12 (DEMO-1842).',
  },
  'qa-client-uat': {
    status: 'in_progress',
    remarks: 'Clinic pilot is in progress with two practices. Sign-off is expected this week.',
  },
  'qa-approval': {
    status: 'not_started',
    remarks: 'Client approval waits on the open Android P1.',
  },
  'gl-ios': {
    status: 'in_progress',
    remarks: 'IPA is uploaded. App Store release has not started.',
  },
  'gl-android': {
    status: 'in_progress',
    remarks: 'AAB is on the internal track only.',
  },
  'gl-client': {
    status: 'not_started',
    remarks: 'Final client approval has not been requested.',
  },
  'gl-done': {
    status: 'not_started',
    remarks: 'Go-live is not marked complete in this demo snapshot.',
  },
};

/**
 * Dummy status, remarks, evidence, and responsible person for one item.
 * @param {{ id: string, label: string, evidence?: boolean }} item
 * @param {{ id: string }} section
 */
function demoItem(item, section) {
  const story = STORY[item.id];
  const status = story?.status || 'completed';
  const responsible = DEMO_OWNERS[section.id] || DEMO_OWNERS.qa;
  let remarks = story?.remarks || '';
  if (!remarks && status === 'completed') {
    remarks = 'Checked on the demo production snapshot.';
  }
  let evidence = story?.evidence || '';
  if (!evidence && item.evidence && status === 'completed') {
    evidence = `https://demo.example/release-checklist/${item.id}`;
  }
  return { status, remarks, evidence, responsible };
}

/**
 * Dummy upload-block fields for web, iOS, or Android.
 * Does not include fileName or storedAs — callers keep any real attachment.
 * @param {'web'|'ios'|'android'} channel
 */
function demoUpload(channel) {
  const uploadDate = new Date().toISOString().slice(0, 10);
  if (channel === 'web') {
    return {
      status: 'verified',
      buildVersion: '1.4.0',
      uploadDate,
      uploadedBy: DEMO_OWNERS.web,
      deploymentUrl: 'https://panel.demo.example',
    };
  }
  if (channel === 'ios') {
    return {
      status: 'app_review',
      appVersion: '1.4.0',
      buildNumber: '214',
      uploadDate,
      uploadedBy: DEMO_OWNERS.ios,
      appStoreUrl: 'https://appstoreconnect.apple.com/',
      testFlightUrl: 'https://appstoreconnect.apple.com/apps',
    };
  }
  return {
    status: 'review',
    appVersion: '1.4.0',
    versionCode: '214',
    uploadDate,
    uploadedBy: DEMO_OWNERS.android,
    playConsoleUrl: 'https://play.google.com/console',
    internalTestingUrl: 'https://demo.example/play-internal',
  };
}

module.exports = { DEMO_OWNERS, demoItem, demoUpload };
