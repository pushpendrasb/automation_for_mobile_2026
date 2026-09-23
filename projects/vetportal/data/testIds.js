/**
 * React Native testIDs shipped in vetpal-vetuser (APP_SOURCE_PATH).
 * Keep in sync with the app — rebuild the app after adding an ID there.
 *
 *   login.*          src/Screens/Login.js
 *   home.menu        src/Screens/Home.js (side-menu button)
 *   subscribeVets.*  src/Screens/SubscribeVets.js
 *   menu.item.<id>   src/Screens/SideMenu.js (8 = Logout)
 *   alert.*          src/Screens/CustomAlert.js (ConfirmAlert)
 *   toast.*          src/Screens/Components/BannerView.js (error/success toast)
 *   signup.*         src/Screens/Signup.js (+ BottomSubmitButton testID prop)
 *   placePicker.*    src/Screens/Components/PlacePicker.js
 *   home.tile.<n>    src/Screens/Home.js (TileItem)
 *   myPrescriptions.* src/Screens/HomePage/MyPrescriptions.js
 *   selectFormat.*   src/Screens/HomePage/MyPrescriptions/SelectFormatPopup.js
 *   compose.*        src/Screens/HomePage/ComposeNewScript.js
 *   searchPopup.*    src/Screens/CustomPopup/PopUpWithSearchBar.js
 *   catPopup.*       src/Screens/HomePage/CatPopup.js
 *   compendium.*     src/Screens/DrugCompendium.js
 *   addMedicine.*    src/Screens/HomePage/AddMedicine.js
 *   animalId.*       src/Screens/Components/AnimalIdentificationSimple.js
 *   signature.*      src/Screens/HomePage/MyPrescriptions/AddSignaturePopup.js
 */
const TEST_IDS = {
  login: {
    screen: 'login.screen',
    email: 'login.email',
    password: 'login.password',
    forgotPassword: 'login.forgotPassword',
    submit: 'login.submit',
    registerNow: 'login.registerNow',
  },
  home: {
    menu: 'home.menu',
  },
  subscribeVets: {
    screen: 'subscribeVets.screen',
  },
  menu: {
    item: id => `menu.item.${id}`,
    logout: 'menu.item.8',
  },
  alert: {
    ok: 'alert.ok',
    cancel: 'alert.cancel',
  },
  signup: {
    screen: 'signup.screen',
    back: 'signup.back',
    profileImage: 'signup.profileImage',
    /** Pencil badge — only rendered once a profile image is set. */
    editProfileImage: 'signup.editProfileImage',
    firstName: 'signup.firstName',
    middleName: 'signup.middleName',
    lastName: 'signup.lastName',
    email: 'signup.email',
    password: 'signup.password',
    mobile: 'signup.mobile',
    qualification: 'signup.qualification',
    vetRegNo: 'signup.vetRegNo',
    address: 'signup.address',
    pickAddress: 'signup.pickAddress',
    eircode: 'signup.eircode',
    agreement: 'signup.agreement',
    terms: 'signup.terms',
    submit: 'signup.submit',
  },
  placePicker: {
    search: 'placePicker.search',
    row: index => `placePicker.row.${index}`,
  },
  toast: {
    banner: 'toast.banner',
    /** Message Text inside the banner (pre-existing ID in BannerView). */
    message: 'text2',
  },
  /** Home grid tiles — index matches Home.js TileItem (0 = My Prescriptions). */
  homeTile: {
    myPrescriptions: 'home.tile.0',
  },
  myPrescriptions: {
    compose: 'myPrescriptions.compose',
  },
  selectFormat: {
    vetPractice: 'selectFormat.vetPractice',
    remedyStore: 'selectFormat.remedyStore',
    close: 'selectFormat.close',
  },
  compose: {
    screen: 'compose.screen',
    back: 'compose.back',
    tab: n => `compose.tab.${n}`,
    practiceName: 'compose.practiceName',
    clientName: 'compose.clientName',
    /** TextInput inside clientName — holds the picked client's name. */
    clientNameValue: 'compose.clientNameValue',
    address: 'compose.address',
    mobile: 'compose.mobile',
    email: 'compose.email',
    /** Free-text Herd No (client has no herds on file). */
    herdNo: 'compose.herdNo',
    /** Herd picker (client has herds on file). */
    herdPicker: 'compose.herdPicker',
    animalCategory: 'compose.animalCategory',
    /** TextInput inside animalCategory — holds the picked "Category - Type". */
    animalCategoryValue: 'compose.animalCategoryValue',
    addCompanion: 'compose.addCompanion',
    addMedicine: 'compose.addMedicine',
    addMoreMedicine: 'compose.addMoreMedicine',
    medicine: index => `compose.medicine.${index}`,
    /** Remedy Store only — Dispenser Details on tab 2. */
    dispenserName: 'compose.dispenserName',
    /** TextInput inside dispenserName — holds the picked dispenser's name. */
    dispenserNameValue: 'compose.dispenserNameValue',
    /** Branch: auto-picked when the dispenser has 1 branch, CatPopup when 2+. */
    branch: 'compose.branch',
    branchValue: 'compose.branchValue',
    /** Bottom button: "Next" on tabs 1–2, "Compose and Dispense" on tab 3. */
    submit: 'compose.submit',
  },
  /** PopUpWithSearchBar — client / dispenser search screen. */
  searchPopup: {
    search: 'searchPopup.search',
    row: index => `searchPopup.row.${index}`,
    close: 'searchPopup.close',
    save: 'searchPopup.save',
  },
  /** CatPopup — bottom-sheet pickers (animal category/type, herd, practice). */
  catPopup: {
    row: index => `catPopup.row.${index}`,
    backdrop: 'catPopup.backdrop',
    save: 'catPopup.save',
  },
  compendium: {
    search: 'compendium.search',
    row: index => `compendium.row.${index}`,
    back: 'compendium.back',
  },
  addMedicine: {
    productName: 'addMedicine.productName',
    quantity: 'addMedicine.quantity',
    dosage: 'addMedicine.dosage',
    submit: 'addMedicine.submit',
  },
  animalId: {
    freeText: 'animalId.freeText',
    age: 'animalId.age',
  },
  signature: {
    pad: 'signature.pad',
    confirm: 'signature.confirm',
    complete: 'signature.complete',
    reset: 'signature.reset',
    close: 'signature.close',
  },
};

module.exports = { TEST_IDS };
