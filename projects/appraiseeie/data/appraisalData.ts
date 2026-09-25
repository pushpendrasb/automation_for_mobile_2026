/**
 * Create Appraisal (TradeIn) fixtures and env-driven photo behaviour.
 *
 * Step 3: APPRAISEE_TYRE_DAMAGE / APPRAISEE_ALLOY_DAMAGE (default tyres DAMAGE).
 *         When either is DAMAGE, the test fills all five damage strip slots.
 * Step 4: Always all six vehicle sides.
 *
 * Optional: APPRAISEE_SKIP_PHOTOS=true (debug).
 */

function envTruthy(raw: string | undefined, defaultValue: boolean): boolean {
  if (raw === undefined || raw.trim() === '') return defaultValue;
  const v = raw.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

export const appraisalData = {
  customerName: "Paul",
  customerEmail: "sami@appdesign.ie",
  registrationRequired: "141KY51",
  registrationTradeIn: "141D6333",
  mileage: "45000",

  randomMobile(): string {
    const n = Math.floor(100000000 + Math.random() * 899999999);
    return String(n);
  },

  get tyreDamage(): boolean {
    return envTruthy(process.env.APPRAISEE_TYRE_DAMAGE, true);
  },

  get alloyDamage(): boolean {
    return envTruthy(process.env.APPRAISEE_ALLOY_DAMAGE, false);
  },

  get skipPhotos(): boolean {
    return envTruthy(process.env.APPRAISEE_SKIP_PHOTOS, false);
  },

  vehiclePhotoSlots: [
    "FRONT",
    "DRIVER FRONT",
    "DRIVER REAR",
    "REAR",
    "PASSENGER REAR",
    "PASSENGER FRONT",
  ] as const,

  damagePhotoSlots: [
    "DRIVER FRONT",
    "DRIVER REAR",
    "PASSENGER FRONT",
    "PASSENGER REAR",
    "EXTRA",
  ] as const,

  /** All vehicle grid sides (step 4). */
  get selectedVehiclePhotoSlots(): string[] {
    return [...this.vehiclePhotoSlots];
  },

  /**
   * Damage strip slots for step 3 when Tyres and/or Alloys is DAMAGE; empty if both OK.
   */
  damagePhotoSlotsFor(tyreDamage: boolean, alloyDamage: boolean): string[] {
    if (!tyreDamage && !alloyDamage) return [];
    return [...this.damagePhotoSlots];
  },

  get selectedDamagePhotoSlots(): string[] {
    return this.damagePhotoSlotsFor(this.tyreDamage, this.alloyDamage);
  },
};
