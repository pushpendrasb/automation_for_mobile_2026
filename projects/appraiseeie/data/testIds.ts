/**
 * Accessibility IDs for Appraisee IE (must match Objective-C app).
 *
 * Login screen  → ViewController.h / ViewController.m
 * Role picker   → LoginUserRoleVC (after successful login — not the login form)
 * Home          → HistoryViewController / TradeIn
 * Side menu     → SideMenuViewController.m
 * Create Appraisal → TradeIn.mm
 */
export const TEST_IDS = {
  /** ViewController — email/password login */
  login: {
    screen: 'login_screen',
    email: 'login_email',
    password: 'login_password',
    submit: 'login_submit_button',
    showHidePassword: 'login_show_hide_password',
    forgotEmail: 'login_forgot_email',
    forgotView: 'login_forgot_password_view',
  },
  /** LoginUserRoleVC — select dealer/role after login */
  userRole: {
    screen: 'login_user_role_screen',
    table: 'login_user_role_table',
    /** Use with index: login_user_role_cell_0 */
    cellPrefix: 'login_user_role_cell_',
    logout: 'login_user_role_logout_button',
  },
  /**
   * Main app after tapping a role cell.
   * HistoryViewController (managers) or TradeIn (sales person).
   */
  home: {
    screen: 'home_screen',
    menuButton: 'home_menu_button',
  },
  /** SideMenuViewController — left drawer */
  sideMenu: {
    screen: 'side_menu_screen',
    table: 'side_menu_table',
    logout: 'side_menu_logout',
    createAppraisal: 'side_menu_item_0',
  },
  /** TradeIn — Create Appraisal wizard */
  tradeIn: {
    customerName: 'tradein_customer_name',
    customerEmail: 'tradein_customer_email',
    customerMobile: 'tradein_customer_mobile',
    reqRegistration: 'tradein_req_registration',
    reqMake: 'tradein_req_make',
    reqModel: 'tradein_req_model',
    reqColour: 'tradein_req_colour',
    reqMileage: 'tradein_req_mileage',
    reqNext: 'tradein_req_next',
    trdRegistration: 'tradein_trd_registration',
    trdMake: 'tradein_trd_make',
    trdModel: 'tradein_trd_model',
    trdColour: 'tradein_trd_colour',
    trdMileage: 'tradein_trd_mileage',
    trdTaxExpiry: 'tradein_trd_tax_expiry',
    trdNctExpiry: 'tradein_trd_nct_expiry',
    trdNext: 'tradein_trd_next',
    tyreOk: 'tradein_tyre_ok',
    tyreDamage: 'tradein_tyre_damage',
    alloyOk: 'tradein_alloy_ok',
    alloyDamage: 'tradein_alloy_damage',
    tyrePhotos: 'tradein_tyre_photos',
    alloyPhotos: 'tradein_alloy_photos',
    damageNext: 'tradein_damage_next',
    vehiclePhotos: 'tradein_vehicle_photos',
    photosSave: 'tradein_photos_save',
  },
} as const;

/**
 * @param index Zero-based role row index
 */
export function userRoleCellId(index: number): string {
  return `${TEST_IDS.userRole.cellPrefix}${index}`;
}
