/**
 * Mirrors RoskidsReactnativeApp/Src/constants/testIds.ts.
 * Page objects tap these ids. Rebuild the app after an id change.
 */
const TEST_IDS = {
  login: {
    email: 'login-email-input',
    password: 'login-password-input',
    signIn: 'login-sign-in-button',
  },
  home: {
    bookService: 'home-book-a-service',
  },
  book: {
    week: index => `book-week-${index}`,
    next: 'book-step-next',
    back: 'book-step-back',
    step1: {
      child: 'book-step1-child',
      location: 'book-step1-location',
      school: 'book-step1-school',
      sibling: 'book-step1-sibling',
    },
    step2: {
      allergy: 'book-step2-allergy',
    },
    step3: {
      morning: 'book-step3-morning',
      selectSlot: 'book-step3-select-slot',
      updateSlot: 'book-step3-update-slot',
    },
    step4: {
      homeTransport: 'book-step4-home-transport',
      dropSchool: 'book-step4-drop-school',
      arklowTransport: 'book-step4-arklow-transport',
      arklowDrop: 'book-step4-arklow-drop',
    },
    step5: {
      afternoon: 'book-step5-afternoon',
      selectSlot: 'book-step5-select-slot',
      updateSlot: 'book-step5-update-slot',
    },
    step6: {
      afternoonTransport: 'book-step6-afternoon-transport',
      arklow: 'book-step6-arklow',
    },
    step7: {
      detailsChecked: 'book-step7-details-checked',
      consent: 'book-step7-consent',
    },
    child: {
      option: index => `book-child-option-${index}`,
      done: 'book-child-done',
      close: 'book-child-close',
    },
    picker: {
      option: index => `book-picker-option-${index}`,
      done: 'book-picker-done',
      close: 'book-picker-close',
    },
    slot: {
      close: 'book-slot-close',
      back: 'book-slot-back',
      next: 'book-slot-next',
    },
    summary: {
      edit: 'book-summary-edit',
      terms: 'book-summary-terms',
      back: 'book-summary-back',
      submit: 'book-summary-submit',
    },
    anotherChildNo: 'book-another-child-no',
    anotherChildYes: 'book-another-child-yes',
    warningContinue: 'book-warning-continue',
    payNow: 'book-pay-now',
  },
};

/** Yes/No row id, e.g. choiceId('book-step2-allergy', 'no'). */
function choiceId(prefix, choice) {
  return `${prefix}-${choice === 'yes' ? 'yes' : 'no'}`;
}

module.exports = { TEST_IDS, choiceId };
