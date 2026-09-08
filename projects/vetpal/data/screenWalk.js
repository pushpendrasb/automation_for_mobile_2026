/**
 * Home tiles and side-menu rows for the one-command screen walk.
 *
 * Tile indexes match Home.js `listItems`. Menu ids match SideMenu.js.
 * Each tile is opened from Home and must leave back to Home (IcnBack).
 * Pending / Dispensed lists open ProductDetails (Request Details or Prescription),
 * swipe the details, then header back before leaving the tile.
 * Delete Account is listed only so the walk can assert it exists and skip it.
 */

/** Labels the screen walk must never tap (destructive / leaves the app). */
const NEVER_TAP = [
  'Delete Account',
  'Mail Us',
  'Clear All',
  'Update Password',
  'Call practice',
];

/** Animal category used when the screen walk creates prescriptions. */
const WALK_ANIMAL_CATEGORY = 'Horse';

/**
 * Dashboard tiles (`home.tile.${index}`).
 * `kind: toast` stays on Home (My Reports → Coming Soon).
 */
const HOME_TILES = [
  {
    index: 0,
    name: 'Request Treatment',
    title: 'Pending Prescriptions',
    kind: 'screen',
    tabs: ['Practice Request Status', 'Store Request scripts'],
  },
  {
    index: 1,
    name: 'Dispensed Prescriptions',
    title: 'Dispensed Prescriptions',
    kind: 'screen',
  },
  {
    index: 2,
    name: 'My Appointments',
    title: 'My Appointments',
    kind: 'screen',
    tabs: ['Pending', 'Confirmed', 'Completed'],
  },
  {
    index: 3,
    name: 'My Reports',
    toast: 'Coming Soon',
    kind: 'toast',
  },
  {
    index: 4,
    name: 'My Remedy Store',
    title: 'My Remedy Store',
    kind: 'screen',
    tabs: ['My Stores', 'Nearby Stores'],
  },
  {
    index: 5,
    name: 'My Practices',
    title: 'My Vet Practice',
    kind: 'screen',
  },
  {
    index: 6,
    name: 'My Messages',
    title: 'My Messages',
    kind: 'screen',
  },
  {
    index: 7,
    name: 'My Profile',
    title: 'My Profile',
    kind: 'profile',
  },
];

/**
 * Side drawer rows. Logout opens a confirm — Cancel only.
 * Tell a Friend opens the iOS/Android share sheet — dismiss, do not share.
 */
const MENU_ITEMS = [
  { id: 2, name: 'Profile', title: 'My Profile' },
  { id: 3, name: 'Contact Us', title: 'Contact Us' },
  { id: 4, name: 'About Us', title: 'About Us' },
  { id: 5, name: 'Tell a Friend', kind: 'share' },
  { id: 6, name: 'Change Password', kind: 'password' },
  { id: 7, name: 'Logout', kind: 'logoutCancel' },
];

module.exports = { NEVER_TAP, HOME_TILES, MENU_ITEMS, WALK_ANIMAL_CATEGORY };
