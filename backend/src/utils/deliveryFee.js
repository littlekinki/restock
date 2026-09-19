const config = require('../config/deliveryConfig');

// ============================================================
// HAVERSINE DISTANCE (km)
// ============================================================
function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371; // Earth radius in km
  const toRad = (deg) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ============================================================
// DISTANCE-BASED BASE FEE
// ============================================================
function baseFeeForDistance(km) {
  for (const tier of config.distanceTiers) {
    if (km <= tier.maxKm) return tier.fee;
  }
  return config.fallbackBaseFee;
}

// ============================================================
// CARTON-EQUIVALENT COUNT (weighted)
// ============================================================
function cartonEquivalent(items) {
  let total = 0;
  for (const item of items) {
    const unit = (item.unit || '').toLowerCase().trim();
    const weight = config.unitWeights[unit] ?? config.defaultUnitWeight;
    total += (item.quantity || 0) * weight;
  }
  return Math.floor(total); // round down favors the customer
}

// ============================================================
// VOLUME SURCHARGE
// ============================================================
function volumeSurchargeFor(cartons) {
  for (const tier of config.volumeTiers) {
    if (cartons <= tier.maxCartons) {
      // If we're in the top tier, add per-extra-carton
      if (tier.maxCartons === Infinity) {
        const extra = Math.max(0, cartons - config.topTierThreshold);
        return tier.fee + extra * config.perExtraCartonFee;
      }
      return tier.fee;
    }
  }
  return 0;
}

// ============================================================
// MAIN — compute full delivery fee
// ============================================================
// items: order items with { productName, quantity, unit }
// shop: { address: { lat, lng } }
// distributor: { address: { lat, lng } }
function computeDeliveryFee(items, shop, distributor) {
  const cartons = cartonEquivalent(items);
  const surcharge = volumeSurchargeFor(cartons);

  const shopLat = shop?.address?.lat;
  const shopLng = shop?.address?.lng;
  const distLat = distributor?.address?.lat;
  const distLng = distributor?.address?.lng;

  let distanceKm = null;
  let baseFee;

  const haveCoords =
    Number.isFinite(shopLat) && Number.isFinite(shopLng) &&
    Number.isFinite(distLat) && Number.isFinite(distLng) &&
    !(shopLat === 0 && shopLng === 0) &&
    !(distLat === 0 && distLng === 0);

  if (haveCoords) {
    distanceKm = haversineKm(shopLat, shopLng, distLat, distLng);
    baseFee = baseFeeForDistance(distanceKm);
  } else {
    baseFee = config.fallbackBaseFee;
  }

  const total = baseFee + surcharge;

  return {
    baseFee,
    surcharge,
    total,
    cartons,
    distanceKm, // null if no coordinates
    usedFallback: !haveCoords,
  };
}

module.exports = {
  computeDeliveryFee,
  haversineKm,
  cartonEquivalent,
  volumeSurchargeFor,
};