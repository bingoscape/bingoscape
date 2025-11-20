/**
 * OSRS Wiki Grand Exchange Price Fetching Service
 *
 * Fetches real-time item prices from the OSRS Wiki API with in-memory caching.
 * API Documentation: https://oldschool.runescape.wiki/w/RuneScape:Real-time_Prices
 */

// Type definitions for GE API responses
interface GEPriceData {
  high: number | null
  highTime: number | null
  low: number | null
  lowTime: number | null
}

interface GELatestResponse {
  data: Record<string, GEPriceData>
}

interface CachedPrice {
  high: number | null;
  low: number | null;
  average: number | null;
  timestamp: number;
}

// In-memory cache with TTL
const priceCache = new Map<number, CachedPrice>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
let lastFullFetch: number | null = null;

/**
 * Get User-Agent string for API requests
 * Uses environment variable for contact info as required by Wiki API
 */
function getUserAgent(): string {
  const contactEmail = process.env.OSRS_WIKI_CONTACT_EMAIL ?? "unknown@example.com"
  return `Bingoscape/1.0.0 - ${contactEmail}`
}

/**
 * Fetch all GE prices from OSRS Wiki API
 * Uses single /latest call for all items (best practice per API docs)
 */
async function fetchAllGEPrices(): Promise<Map<number, CachedPrice>> {
  try {
    const response = await fetch("https://prices.runescape.wiki/api/v1/osrs/latest", {
      headers: {
        "User-Agent": getUserAgent(),
      },
    })

    if (!response.ok) {
      throw new Error(`GE API returned status ${response.status}`)
    }

    const data = (await response.json()) as GELatestResponse
    const now = Date.now()
    const prices = new Map<number, CachedPrice>()

    // Process and cache all prices
    for (const [itemIdStr, priceData] of Object.entries(data.data)) {
      const itemId = parseInt(itemIdStr, 10);
      const high = priceData.high;
      const low = priceData.low;

      // Calculate average of high and low prices
      let average: number | null = null;
      if (high !== null && low !== null) {
        average = Math.floor((high + low) / 2);
      } else if (high !== null) {
        average = high;
      } else if (low !== null) {
        average = low;
      }

      const cachedPrice: CachedPrice = {
        high,
        low,
        average,
        timestamp: now,
      };

      prices.set(itemId, cachedPrice);
      priceCache.set(itemId, cachedPrice);
    }

    lastFullFetch = now;
    return prices;
  } catch (error) {
    console.error("Error fetching GE prices:", error);
    throw new Error(`Failed to fetch GE prices: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * Check if cache needs refreshing
 */
function isCacheStale(): boolean {
  if (lastFullFetch === null) {
    return true;
  }
  return Date.now() - lastFullFetch > CACHE_TTL_MS;
}

/**
 * Get price for a single item from cache or fetch if needed
 */
export async function getItemPrice(itemId: number): Promise<CachedPrice | null> {
  // Check if cache is stale and refresh if needed
  if (isCacheStale()) {
    await fetchAllGEPrices();
  }

  // Return cached price or null if not found
  return priceCache.get(itemId) ?? null;
}

/**
 * Get prices for multiple items efficiently
 * Returns Map with itemId as key
 */
export async function getPricesForItems(itemIds: number[]): Promise<Map<number, CachedPrice>> {
  // Refresh cache if stale
  if (isCacheStale()) {
    await fetchAllGEPrices();
  }

  const prices = new Map<number, CachedPrice>();

  for (const itemId of itemIds) {
    const price = priceCache.get(itemId);
    if (price) {
      prices.set(itemId, price);
    }
  }

  return prices;
}

/**
 * Get all cached prices (refreshes if stale)
 * Useful for statistics that need comprehensive price data
 */
export async function getAllGEPrices(): Promise<Map<number, CachedPrice>> {
  if (isCacheStale()) {
    return await fetchAllGEPrices();
  }
  return new Map(priceCache);
}

/**
 * Force refresh the price cache
 * Useful for admin operations or manual refresh triggers
 */
export async function refreshPriceCache(): Promise<void> {
  await fetchAllGEPrices();
}

/**
 * Get cache statistics for monitoring
 */
export function getCacheStats(): {
  itemCount: number;
  lastFetchTime: number | null;
  cacheAge: number | null;
  isStale: boolean;
} {
  return {
    itemCount: priceCache.size,
    lastFetchTime: lastFullFetch,
    cacheAge: lastFullFetch ? Date.now() - lastFullFetch : null,
    isStale: isCacheStale(),
  };
}

/**
 * Clear the price cache
 * Useful for testing or troubleshooting
 */
export function clearPriceCache(): void {
  priceCache.clear();
  lastFullFetch = null;
}

/**
 * Helper to get average price value (most common use case)
 */
export async function getItemAveragePrice(itemId: number): Promise<number | null> {
  const price = await getItemPrice(itemId);
  return price?.average ?? null;
}

/**
 * Helper to get multiple item average prices
 */
export async function getItemAveragePrices(itemIds: number[]): Promise<Map<number, number>> {
  const prices = await getPricesForItems(itemIds);
  const averages = new Map<number, number>();

  for (const [itemId, price] of prices.entries()) {
    if (price.average !== null) {
      averages.set(itemId, price.average);
    }
  }

  return averages;
}
