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
};

module.exports = { TEST_IDS };
