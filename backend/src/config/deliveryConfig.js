// ============================================================
// DELIVERY FEE CONFIGURATION
// ============================================================
// Platform-owner controlled. Edit the numbers here — no code change needed.
// ============================================================

module.exports = {
  // Distance tiers (km → base fee in ₦)
  // Used when shop + distributor both have lat/lng.
  distanceTiers: [
    { maxKm: 2,   fee: 300 },
    { maxKm: 5,   fee: 500 },
    { maxKm: 10,  fee: 800 },
    { maxKm: 15,  fee: 1200 },
    { maxKm: 20,  fee: 1600 },
    { maxKm: Infinity, fee: 2000 },
  ],

  // Flat fallback when coordinates are missing
  fallbackBaseFee: 800,

  // Volume surcharge (carton-equivalents → surcharge in ₦)
  volumeTiers: [
    { maxCartons: 3,  fee: 0 },
    { maxCartons: 6,  fee: 200 },
    { maxCartons: 10, fee: 400 },
    { maxCartons: 15, fee: 600 },
    { maxCartons: 20, fee: 900 },
    { maxCartons: Infinity, fee: 900 }, // + perExtraCarton below
  ],

  // Extra charge per carton above the top tier
  perExtraCartonFee: 50,
  topTierThreshold: 20,

  // Unit → carton-equivalent weights
  unitWeights: {
    carton: 1.0,
    pack: 0.5,
    kg: 0.25,
    litre: 0.25,
    piece: 0.05,
  },

  // Default weight if unit missing or unknown
  defaultUnitWeight: 0.25,
};