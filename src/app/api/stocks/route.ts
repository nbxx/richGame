import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getQuote, type FinnhubQuote } from '@/lib/finnhub'

const CACHE_TTL_MS = 15_000 // 15 seconds

/**
 * GET /api/stocks — Return all tradable stocks with cached prices
 */
export async function GET() {
  try {
    const supabase = createAdminClient()

    // Fetch all active stocks with their cached prices
    const { data: stocks, error } = await supabase
      .from('stocks')
      .select(`
        symbol,
        company_name,
        exchange,
        sector,
        stock_prices (
          current_price,
          previous_close,
          change_amount,
          change_percent,
          volume,
          market_open,
          cached_at
        )
      `)
      .eq('is_active', true)
      .order('symbol')

    if (error) {
      console.error('Error fetching stocks:', error)
      return NextResponse.json({ error: 'Failed to fetch stocks' }, { status: 500 })
    }

    // Check which prices need refreshing
    const now = Date.now()
    const staleSymbols: string[] = []

    for (const stock of stocks || []) {
      const priceData = Array.isArray(stock.stock_prices)
        ? stock.stock_prices[0]
        : stock.stock_prices
      if (!priceData || !priceData.cached_at) {
        staleSymbols.push(stock.symbol)
      } else {
        const cachedTime = new Date(priceData.cached_at).getTime()
        if (now - cachedTime > CACHE_TTL_MS) {
          staleSymbols.push(stock.symbol)
        }
      }
    }

    // Refresh stale prices (batch, max 15 at a time to stay within rate limits)
    if (staleSymbols.length > 0) {
      const toRefresh = staleSymbols.slice(0, 15)
      const refreshPromises = toRefresh.map(async (symbol) => {
        try {
          const quote: FinnhubQuote = await getQuote(symbol)
          if (quote.c > 0) {
            await supabase
              .from('stock_prices')
              .upsert({
                symbol,
                current_price: quote.c,
                previous_close: quote.pc,
                change_amount: quote.d,
                change_percent: quote.dp,
                volume: undefined, // Finnhub quote doesn't include volume
                market_open: true, // Will be updated separately
                cached_at: new Date().toISOString(),
              })
          }
        } catch (e) {
          console.error(`Failed to refresh price for ${symbol}:`, e)
        }
      })
      await Promise.all(refreshPromises)

      // Re-fetch with updated prices
      const { data: updatedStocks, error: refetchError } = await supabase
        .from('stocks')
        .select(`
          symbol,
          company_name,
          exchange,
          sector,
          stock_prices (
            current_price,
            previous_close,
            change_amount,
            change_percent,
            volume,
            market_open,
            cached_at
          )
        `)
        .eq('is_active', true)
        .order('symbol')

      if (!refetchError && updatedStocks) {
        const formatted = updatedStocks.map(formatStock)
        return NextResponse.json({ stocks: formatted })
      }
    }

    const formatted = (stocks || []).map(formatStock)
    return NextResponse.json({ stocks: formatted })
  } catch (e) {
    console.error('Stocks API error:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function formatStock(stock: any) {
  const priceData = Array.isArray(stock.stock_prices)
    ? stock.stock_prices[0]
    : stock.stock_prices

  return {
    symbol: stock.symbol,
    companyName: stock.company_name,
    exchange: stock.exchange,
    sector: stock.sector,
    price: priceData?.current_price ?? 0,
    previousClose: priceData?.previous_close ?? 0,
    change: priceData?.change_amount ?? 0,
    changePercent: priceData?.change_percent ?? 0,
    marketOpen: priceData?.market_open ?? false,
    cachedAt: priceData?.cached_at ?? null,
  }
}
