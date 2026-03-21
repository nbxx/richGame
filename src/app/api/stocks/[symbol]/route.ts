import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getQuote } from '@/lib/finnhub'

const CACHE_TTL_MS = 30_000 // 30 seconds

/**
 * GET /api/stocks/[symbol] — Return single stock with real-time price
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
) {
  try {
    const { symbol } = await params
    const upperSymbol = symbol.toUpperCase()

    const supabase = createAdminClient()

    // Fetch stock info
    const { data: stock, error: stockError } = await supabase
      .from('stocks')
      .select('symbol, company_name, exchange, sector, is_active')
      .eq('symbol', upperSymbol)
      .single()

    if (stockError || !stock) {
      return NextResponse.json({ error: 'Stock not found' }, { status: 404 })
    }

    if (!stock.is_active) {
      return NextResponse.json({ error: 'Stock is not tradable' }, { status: 400 })
    }

    // Check cache
    const { data: cached } = await supabase
      .from('stock_prices')
      .select('*')
      .eq('symbol', upperSymbol)
      .single()

    const now = Date.now()
    const isStale =
      !cached ||
      !cached.cached_at ||
      now - new Date(cached.cached_at).getTime() > CACHE_TTL_MS

    let priceData = cached

    if (isStale) {
      try {
        const quote = await getQuote(upperSymbol)
        if (quote.c > 0) {
          const newData = {
            symbol: upperSymbol,
            current_price: quote.c,
            previous_close: quote.pc,
            change_amount: quote.d,
            change_percent: quote.dp,
            market_open: true,
            cached_at: new Date().toISOString(),
          }
          await supabase
            .from('stock_prices')
            .upsert(newData)

          priceData = newData as typeof cached
        }
      } catch (e) {
        console.error(`Failed to refresh price for ${upperSymbol}:`, e)
        // Fall back to cached data
      }
    }

    return NextResponse.json({
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
    })
  } catch (e) {
    console.error('Stock detail API error:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
