-- =============================================
-- 预设可交易股票列表 — S&P 500 + 纳斯达克代表股
-- 在 migration.sql 之后运行
-- =============================================

INSERT INTO public.stocks (symbol, company_name, exchange, sector) VALUES
-- Technology
('AAPL', 'Apple Inc.', 'NASDAQ', 'Technology'),
('MSFT', 'Microsoft Corporation', 'NASDAQ', 'Technology'),
('GOOGL', 'Alphabet Inc.', 'NASDAQ', 'Technology'),
('AMZN', 'Amazon.com Inc.', 'NASDAQ', 'Technology'),
('NVDA', 'NVIDIA Corporation', 'NASDAQ', 'Technology'),
('META', 'Meta Platforms Inc.', 'NASDAQ', 'Technology'),
('TSLA', 'Tesla Inc.', 'NASDAQ', 'Technology'),
('NFLX', 'Netflix Inc.', 'NASDAQ', 'Technology'),
('AVGO', 'Broadcom Inc.', 'NASDAQ', 'Technology'),
('ADBE', 'Adobe Inc.', 'NASDAQ', 'Technology'),
('CRM', 'Salesforce Inc.', 'NYSE', 'Technology'),
('AMD', 'Advanced Micro Devices', 'NASDAQ', 'Technology'),
('INTC', 'Intel Corporation', 'NASDAQ', 'Technology'),
('CSCO', 'Cisco Systems Inc.', 'NASDAQ', 'Technology'),
('ORCL', 'Oracle Corporation', 'NYSE', 'Technology'),
('QCOM', 'Qualcomm Inc.', 'NASDAQ', 'Technology'),
('IBM', 'IBM Corporation', 'NYSE', 'Technology'),
('MU', 'Micron Technology', 'NASDAQ', 'Technology'),
('AMAT', 'Applied Materials', 'NASDAQ', 'Technology'),
('SHOP', 'Shopify Inc.', 'NYSE', 'Technology'),

-- Finance
('JPM', 'JPMorgan Chase & Co.', 'NYSE', 'Finance'),
('BAC', 'Bank of America Corp.', 'NYSE', 'Finance'),
('WFC', 'Wells Fargo & Co.', 'NYSE', 'Finance'),
('GS', 'Goldman Sachs Group', 'NYSE', 'Finance'),
('MS', 'Morgan Stanley', 'NYSE', 'Finance'),
('V', 'Visa Inc.', 'NYSE', 'Finance'),
('MA', 'Mastercard Inc.', 'NYSE', 'Finance'),
('AXP', 'American Express Co.', 'NYSE', 'Finance'),
('BLK', 'BlackRock Inc.', 'NYSE', 'Finance'),
('C', 'Citigroup Inc.', 'NYSE', 'Finance'),

-- Consumer
('WMT', 'Walmart Inc.', 'NYSE', 'Consumer'),
('COST', 'Costco Wholesale', 'NASDAQ', 'Consumer'),
('MCD', 'McDonald''s Corporation', 'NYSE', 'Consumer'),
('NKE', 'Nike Inc.', 'NYSE', 'Consumer'),
('SBUX', 'Starbucks Corporation', 'NASDAQ', 'Consumer'),
('HD', 'The Home Depot', 'NYSE', 'Consumer'),
('LOW', 'Lowe''s Companies', 'NYSE', 'Consumer'),
('TGT', 'Target Corporation', 'NYSE', 'Consumer'),
('PG', 'Procter & Gamble', 'NYSE', 'Consumer'),
('KO', 'Coca-Cola Company', 'NYSE', 'Consumer'),
('PEP', 'PepsiCo Inc.', 'NASDAQ', 'Consumer'),

-- Healthcare
('JNJ', 'Johnson & Johnson', 'NYSE', 'Healthcare'),
('UNH', 'UnitedHealth Group', 'NYSE', 'Healthcare'),
('PFE', 'Pfizer Inc.', 'NYSE', 'Healthcare'),
('ABBV', 'AbbVie Inc.', 'NYSE', 'Healthcare'),
('MRK', 'Merck & Co.', 'NYSE', 'Healthcare'),
('LLY', 'Eli Lilly and Company', 'NYSE', 'Healthcare'),
('TMO', 'Thermo Fisher Scientific', 'NYSE', 'Healthcare'),
('ABT', 'Abbott Laboratories', 'NYSE', 'Healthcare'),

-- Energy
('XOM', 'Exxon Mobil Corporation', 'NYSE', 'Energy'),
('CVX', 'Chevron Corporation', 'NYSE', 'Energy'),
('COP', 'ConocoPhillips', 'NYSE', 'Energy'),
('SLB', 'Schlumberger NV', 'NYSE', 'Energy'),

-- Industrials
('BA', 'Boeing Company', 'NYSE', 'Industrials'),
('CAT', 'Caterpillar Inc.', 'NYSE', 'Industrials'),
('HON', 'Honeywell International', 'NASDAQ', 'Industrials'),
('UPS', 'United Parcel Service', 'NYSE', 'Industrials'),
('GE', 'GE Aerospace', 'NYSE', 'Industrials'),
('DE', 'Deere & Company', 'NYSE', 'Industrials'),

-- Communication
('DIS', 'Walt Disney Company', 'NYSE', 'Communication'),
('CMCSA', 'Comcast Corporation', 'NASDAQ', 'Communication'),
('T', 'AT&T Inc.', 'NYSE', 'Communication'),
('VZ', 'Verizon Communications', 'NYSE', 'Communication'),

-- ETFs
('SPY', 'SPDR S&P 500 ETF Trust', 'NYSE', 'ETF'),
('QQQ', 'Invesco QQQ Trust', 'NASDAQ', 'ETF'),
('DIA', 'SPDR Dow Jones ETF', 'NYSE', 'ETF'),
('IWM', 'iShares Russell 2000 ETF', 'NYSE', 'ETF'),
('VTI', 'Vanguard Total Stock Market', 'NYSE', 'ETF')
ON CONFLICT (symbol) DO NOTHING;

-- Initialize stock_prices entries for each stock
INSERT INTO public.stock_prices (symbol, current_price, market_open, cached_at)
SELECT symbol, 0, false, '1970-01-01'::timestamptz
FROM public.stocks
ON CONFLICT (symbol) DO NOTHING;
