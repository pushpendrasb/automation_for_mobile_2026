/**
 * Create Appraisal (TradeIn) fixtures and env-driven options.
 *
 * Override with .env:
 * - APPRAISEE_TYRE_DAMAGE=true|false (default true)
 * - APPRAISEE_ALLOY_DAMAGE=true|false (default false)
 * - APPRAISEE_SKIP_PHOTOS=true to skip photo taps (debug only)
 */
export const appraisalData = {
  customerName: 'Paul',
  customerEmail: 'sami@appdesign.ie',
  /** Irish-style plate used for lookup / auto-fill */
  registration: '141D6333',
  /** Trade-in mileage when validation fails */
  mileage: '45000',

  /** Random mobile — digits only, not a validated Irish mobile */
  randomMobile(): string {
    const n = Math.floor(100000000 + Math.random() * 899999999);
    return String(n);
  },

  get tyreDamage(): boolean {
    const raw = (process.env.APPRAISEE_TYRE_DAMAGE || 'true').trim().toLowerCase();
    return raw === '1' || raw === 'true' || raw === 'yes';
  },

  get alloyDamage(): boolean {
    const raw = (process.env.APPRAISEE_ALLOY_DAMAGE || 'false').trim().toLowerCase();
    return raw === '1' || raw === 'true' || raw === 'yes';
  },

  get skipPhotos(): boolean {
    const raw = (process.env.APPRAISEE_SKIP_PHOTOS || 'false').trim().toLowerCase();
    return raw === '1' || raw === 'true' || raw === 'yes';
  },

  /** Labels on vehicle photo grid (step 4) */
  vehiclePhotoSlots: [
    'FRONT',
    'DRIVER FRONT',
    'DRIVER REAR',
    'REAR',
    'PASSENGER REAR',
    'PASSENGER FRONT',
  ] as const,

  /** Tyre damage photo slots (step 3 when DAMAGE selected) */
  tyrePhotoSlots: [
    'DRIVER FRONT',
    'DRIVER REAR',
    'PASSENGER FRONT',
    'PASSENGER REAR',
  ] as const,
};
