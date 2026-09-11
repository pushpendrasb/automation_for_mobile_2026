/**
 * Accessibility identifiers for Appraisee IE (must match Objective-C app).
 *
 * Login screen  → ViewController.h / ViewController.m
 * Role picker   → LoginUserRoleVC (after successful login — not the login form)
 * Home          → HistoryViewController / TradeIn
 * Side menu     → SideMenuViewController.m
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
  },
} as const;

/**
 * @param index Zero-based role row index
 */
export function userRoleCellId(index: number): string {
  return `${TEST_IDS.userRole.cellPrefix}${index}`;
}
