/**
 * Mirrors vetpal-animal-owner/src/Constants/testIds.js
 *
 * Rebuild/reinstall the Vet Pal app after those testIDs land.
 * Page objects tap these IDs only — no screen width/height fallbacks.
 */
const TEST_IDS = {
  login: {
    signInTab: 'login.signInTab',
    signUpTab: 'login.signUpTab',
    mobile: 'login.mobile',
    email: 'login.email',
    password: 'login.password',
    confirmPassword: 'login.confirmPassword',
    forgotPassword: 'login.forgotPassword',
    submit: 'login.submit',
    tncCheckbox: 'login.tncCheckbox',
  },
  home: {
    tile: index => `home.tile.${index}`,
    requestTreatment: 'home.tile.0',
    menu: 'home.menu',
  },
  menu: {
    logout: 'menu.logout',
  },
  alert: {
    ok: 'alert.ok',
    cancel: 'alert.cancel',
  },
  pending: {
    requestAdvice: 'pending.requestAdvice',
  },
  provider: {
    close: 'provider.close',
    vetPractice: 'provider.vetPractice',
    nearby: 'provider.nearby',
  },
  requestTreatment: {
    header: 'rt.header',
    back: 'rt.back',
    vetPracticeField: 'rt.vetPractice.field',
    goToMyVetPractice: 'rt.goToMyVetPractice',
    remedyStoreField: 'rt.remedyStore.field',
    branchField: 'rt.branch.field',
    goToMyRemedyStore: 'rt.goToMyRemedyStore',
    next: 'rt.next',
    submit: 'rt.submit',
    animalCategoryField: 'rt.animalCategory.field',
    treatmentInput: 'rt.treatmentInput',
    addPhoto: 'rt.addPhoto',
    nearbySearch: 'rt.nearby.search',
    nearbyStoreCard: index => `rt.nearby.store.${index}`,
  },
  vetPracticePopup: {
    title: 'vetPopup.title',
    row: index => `vetPopup.row.${index}`,
    save: 'vetPopup.save',
    goToMyPractice: 'vetPopup.goToMyPractice',
  },
  catPopup: {
    title: 'catPopup.title',
    row: index => `catPopup.row.${index}`,
    save: 'catPopup.save',
  },
  remedyStoreModal: {
    search: 'storeModal.search',
    card: index => `storeModal.card.${index}`,
    save: 'storeModal.save',
  },
  animalId: {
    field: (mode, key, index = 0) => `animalId.${mode}.${key}.${index}`,
    ageUnit: (target, index = 0) => `animalId.ageUnit.${target}.${index}`,
  },
  summary: {
    submitNow: 'summary.submitNow',
  },
  /** react-native-keyboard-controller KeyboardToolbar.Done */
  keyboard: {
    done: 'keyboard.toolbar.done',
  },
};

module.exports = { TEST_IDS };
