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
    countryCode: 'login.countryCode',
    countrySave: 'login.countrySave',
    countryOption: code =>
      `login.country.${String(code).replace(/^\+/, '')}`,
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
  /** react-native-keyboard-controller KeyboardToolbar (Done / Next). */
  keyboard: {
    done: 'keyboard.toolbar.done',
    next: 'keyboard.toolbar.next',
  },
  otp: {
    input: 'otp.input',
    verify: 'otp.verify',
  },
  signupSuccess: {
    ok: 'signupSuccess.ok',
  },
  placePicker: {
    search: 'placePicker.search',
    result: index => `placePicker.result.${index}`,
  },
  profile: {
    firstName: 'profile.firstName',
    lastName: 'profile.lastName',
    address: 'profile.address',
    addressMap: 'profile.addressMap',
    county: 'profile.county',
    country: 'profile.country',
    countrySave: 'profile.countrySave',
    countryOption: name =>
      `profile.country.${String(name).replace(/^\+/, '').replace(/\s+/g, '_')}`,
    postcode: 'profile.postcode',
    mobile: 'profile.mobile',
    company: 'profile.company',
    animal: key => `profile.animal.${key}`,
    herdNo: 'profile.herdNo',
    organic: 'profile.organic',
    organicYes: 'profile.organic.yes',
    organicNo: 'profile.organic.no',
    petEdit: 'profile.pet.edit',
    petDelete: 'profile.pet.delete',
    petHistory: 'profile.pet.history',
    addCompanion: 'profile.addCompanion',
    submit: 'profile.submit',
  },
  subscribe: {
    skip: 'subscribe.skip',
  },
};

module.exports = { TEST_IDS };
