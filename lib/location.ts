import { withCache } from "./cache";
import type { GeoLocation } from "@/types";

const PINCODE_TTL_MS = 24 * 60 * 60 * 1000; // pincode -> coordinates is effectively static
const FETCH_TIMEOUT_MS = 5000;

function isValidIndianPincode(pincode: string): boolean {
  return /^[1-9][0-9]{5}$/.test(pincode);
}

async function fetchWithTimeout(url: string, init?: RequestInit) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * The QuickCommerce API takes lat/lon, not pincode, for Blinkit/Zepto/Instamart.
 * We resolve the user's pincode to a representative coordinate via India Post
 * (validation + district/state) and OpenStreetMap Nominatim (geocoding).
 * This is a centroid approximation, not the user's exact address — acceptable
 * for an MVP but worth knowing about if results feel off for a large pincode area.
 */
export async function resolvePincode(
  pincode: string
): Promise<{ ok: true; location: GeoLocation } | { ok: false; error: string }> {
  if (!isValidIndianPincode(pincode)) {
    return { ok: false, error: "Enter a valid 6-digit Indian pincode." };
  }

  return withCache(
    `pincode:${pincode}`,
    PINCODE_TTL_MS,
    async () => {
    try {
      const postRes = await fetchWithTimeout(
        `https://api.postalpincode.in/pincode/${pincode}`
      );
      if (!postRes.ok) {
        return { ok: false, error: "Could not verify that pincode right now." };
      }
      const postData = await postRes.json();
      const record = Array.isArray(postData) ? postData[0] : null;
      if (!record || record.Status !== "Success" || !record.PostOffice?.length) {
        return { ok: false, error: "That pincode doesn't look valid." };
      }

      const office = record.PostOffice[0];
      const district: string = office.District;
      const state: string = office.State;

      const geoRes = await fetchWithTimeout(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(
          `${pincode}, India`
        )}`,
        { headers: { "User-Agent": "khoj-quickcommerce-mvp/0.1 (contact via app)" } }
      );
      const geoData = geoRes.ok ? await geoRes.json() : [];
      let lat: number | undefined;
      let lon: number | undefined;
      if (Array.isArray(geoData) && geoData[0]) {
        lat = parseFloat(geoData[0].lat);
        lon = parseFloat(geoData[0].lon);
      }

      if (lat === undefined || lon === undefined || Number.isNaN(lat) || Number.isNaN(lon)) {
        // Fall back to geocoding the district/state centroid if the exact
        // postcode has no OSM entry.
        const fallbackRes = await fetchWithTimeout(
          `https://nominatim.openstreetmap.org/search?format=json&limit=1&country=India&state=${encodeURIComponent(
            state
          )}&city=${encodeURIComponent(district)}`,
          { headers: { "User-Agent": "khoj-quickcommerce-mvp/0.1 (contact via app)" } }
        );
        const fallbackData = fallbackRes.ok ? await fallbackRes.json() : [];
        if (Array.isArray(fallbackData) && fallbackData[0]) {
          lat = parseFloat(fallbackData[0].lat);
          lon = parseFloat(fallbackData[0].lon);
        }
      }

      if (lat === undefined || lon === undefined || Number.isNaN(lat) || Number.isNaN(lon)) {
        return { ok: false, error: "Couldn't resolve that pincode to a location." };
      }

      return { ok: true, location: { pincode, lat, lon } };
    } catch {
      return { ok: false, error: "Location lookup timed out. Try again." };
    }
    },
    (result) => result.ok
  );
}
