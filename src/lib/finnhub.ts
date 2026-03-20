const FINNHUB_BASE = 'https://finnhub.io/api/v1'

function getApiKey(): string {
  const key = process.env.FINNHUB_API_KEY
  if (!key) throw new Error('FINNHUB_API_KEY is not set')
  return key
}

export interface FinnhubQuote {
  c: number   // Current price
  d: number   // Change
  dp: number  // Percent change
  h: number   // High price of the day
  l: number   // Low price of the day
  o: number   // Open price of the day
  pc: number  // Previous close price
  t: number   // Timestamp
}

export interface MarketStatusResponse {
  exchange: string
  holiday: string | null
  isOpen: boolean
  session: string
  t: number
  timezone: string
}

/**
 * Get a real-time quote for a symbol from Finnhub
 */
export async function getQuote(symbol: string): Promise<FinnhubQuote> {
  const res = await fetch(
    `${FINNHUB_BASE}/quote?symbol=${encodeURIComponent(symbol)}&token=${getApiKey()}`,
    { cache: 'no-store' }
  )
  if (!res.ok) {
    throw new Error(`Finnhub API error: ${res.status} ${res.statusText}`)
  }
  return res.json()
}

/**
 * Get US market status (open/closed)
 */
export async function getMarketStatus(): Promise<MarketStatusResponse> {
  const res = await fetch(
    `${FINNHUB_BASE}/stock/market-status?exchange=US&token=${getApiKey()}`,
    { cache: 'no-store' }
  )
  if (!res.ok) {
    throw new Error(`Finnhub API error: ${res.status} ${res.statusText}`)
  }
  return res.json()
}

/**
 * Batch fetch quotes for multiple symbols
 * Rate-limited to respect Finnhub's 60 calls/min
 */
export async function getBatchQuotes(
  symbols: string[]
): Promise<Record<string, FinnhubQuote>> {
  const results: Record<string, FinnhubQuote> = {}

  // Fetch in parallel, max 10 at a time to be safe
  const batchSize = 10
  for (let i = 0; i < symbols.length; i += batchSize) {
    const batch = symbols.slice(i, i + batchSize)
    const promises = batch.map(async (symbol) => {
      try {
        const quote = await getQuote(symbol)
        results[symbol] = quote
      } catch (e) {
        console.error(`Failed to fetch quote for ${symbol}:`, e)
      }
    })
    await Promise.all(promises)

    // Small delay between batches to respect rate limits
    if (i + batchSize < symbols.length) {
      await new Promise((resolve) => setTimeout(resolve, 200))
    }
  }

  return results
}
