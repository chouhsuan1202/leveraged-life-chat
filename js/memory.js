/**
 * Global Multi-Account Long-Term Memory Hub & Statement Parser
 * Replaces old row-by-row table entry with intelligent statement & snapshot parsing
 */

export const DEMO_PRESETS = {
  ibkr_eur: {
    accountId: "ibkr_eur_01",
    accountName: "IBKR 歐洲投資帳戶",
    source: "IBKR 截圖 / 對帳單",
    updatedAt: "2026-07-27 12:36",
    currency: "EUR",
    netLiquidation: 25659.15,
    settledCash: -2821.16,
    positionsValue: 28474.23,
    marginLoan: 2821.16,
    dailyPnl: 177.10,
    unrealizedPnl: -370.32,
    maintenanceMargin: 7120.08,
    excessLiquidity: 18539.07,
    buyingPower: 116467.80,
    borrowingRatio: 11.0, // marginLoan / netLiquidation
    effectiveLeverage: 1.11, // positionsValue / netLiquidation
    safeLimit20: 5131.83,
    safeRoom: 2310.67,
    marginCallDrop: 87.0,
    warningDrop: 41.0,
    marginCushion: 72.0,
    cashBuffer: -11.0,
    note: "來自 2026-07-27 12:36 IBKR Positions 截圖讀值。包含 4GLD, SECO, SXR8, SXRV 四個持倉與 2,821 EUR 融資借款。",
    holdings: [
      { name: "4GLD", ticker: "XETRA-GOLD", marketValue: 4969.94, capitalWeight: 19, leverage: 1, effectiveExposure: 4969.94 },
      { name: "SECO", ticker: "iShares MSCI GLB SEMICNDCT A", marketValue: 5261.65, capitalWeight: 21, leverage: 1, effectiveExposure: 5261.65 },
      { name: "SXR8", ticker: "iShares Core S&P 500", marketValue: 11040.64, capitalWeight: 43, leverage: 1, effectiveExposure: 11040.64 },
      { name: "SXRV", ticker: "iShares NASDAQ 100 USD ACC", marketValue: 7202.00, capitalWeight: 28, leverage: 1, effectiveExposure: 7202.00 },
      { name: "融資借款", ticker: "Margin Loan", marketValue: -2821.16, capitalWeight: -11, leverage: 0, effectiveExposure: 0 }
    ]
  },
  taiwan_pledge: {
    accountId: "taiwan_pledge_01",
    accountName: "台灣國內券商股票質押帳戶",
    source: "台灣集保與券商對帳單",
    updatedAt: "2026-07-28 10:00",
    currency: "TWD",
    netLiquidation: 4000000.00, // 500萬股票 - 100萬借款
    settledCash: 0,
    positionsValue: 5000000.00,
    marginLoan: 1000000.00,
    dailyPnl: 0,
    unrealizedPnl: 800000.00,
    maintenanceMargin: 1300000.00, // 130% 的 100萬借款
    excessLiquidity: 3700000.00, // 500萬 - 130萬
    buyingPower: 0,
    borrowingRatio: 25.0, // 100萬 / 400萬
    effectiveLeverage: 1.25, // 500萬 / 400萬
    maintenanceRatio: 500.0, // (500萬/100萬)*100%
    staticDropTo130: 74.0, // 價格得下跌74%才觸及130%
    note: "來自台灣集中保管結算所與券商質押對帳單。持股市值 500 萬，設質借款 100 萬，維持率 500%，可承受靜態跌幅 74%。",
    holdings: [
      { name: "0050 元大台灣50", ticker: "0050.TW", marketValue: 3000000.00, capitalWeight: 60, leverage: 1, effectiveExposure: 3000000.00 },
      { name: "00631L 元大台灣50正2", ticker: "00631L.TW", marketValue: 1000000.00, capitalWeight: 20, leverage: 2, effectiveExposure: 2000000.00 },
      { name: "006208 富邦台50", ticker: "006208.TW", marketValue: 1000000.00, capitalWeight: 20, leverage: 1, effectiveExposure: 1000000.00 }
    ]
  },
  us_firstrade: {
    accountId: "us_firstrade_01",
    accountName: "美國 Firstrade 海外券商帳戶",
    source: "Firstrade 月結單",
    updatedAt: "2026-07-25 16:00",
    currency: "USD",
    netLiquidation: 50000.00,
    settledCash: 5000.00,
    positionsValue: 45000.00,
    marginLoan: 0,
    dailyPnl: 250.00,
    unrealizedPnl: 6500.00,
    maintenanceMargin: 11250.00,
    excessLiquidity: 38750.00,
    buyingPower: 100000.00,
    borrowingRatio: 0,
    effectiveLeverage: 0.90,
    note: "來自美國 Firstrade 海外帳戶。包含 VOO 25,000 USD, QQQ 20,000 USD 與 5,000 USD 現金儲備。",
    holdings: [
      { name: "VOO", ticker: "Vanguard S&P 500 ETF", marketValue: 25000.00, capitalWeight: 50, leverage: 1, effectiveExposure: 25000.00 },
      { name: "QQQ", ticker: "Invesco QQQ Trust", marketValue: 20000.00, capitalWeight: 40, leverage: 1, effectiveExposure: 20000.00 },
      { name: "USD Cash", ticker: "USD", marketValue: 5000.00, capitalWeight: 10, leverage: 0, effectiveExposure: 0 }
    ]
  }
};

/**
 * Load Accounts from localStorage
 */
export function getSavedAccounts() {
  const saved = localStorage.getItem('global_memory_accounts');
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (e) {}
  }
  // Default to pre-populating IBKR Europe and Taiwan Pledged Account
  return [DEMO_PRESETS.ibkr_eur, DEMO_PRESETS.taiwan_pledge];
}

/**
 * Save Accounts to localStorage
 */
export function saveAccounts(accounts) {
  localStorage.setItem('global_memory_accounts', JSON.stringify(accounts));
}

/**
 * Intelligent Statement Text Parser
 */
export function parseRawStatementText(rawText) {
  if (!rawText || typeof rawText !== 'string') return null;

  // Check if rawText is JSON
  try {
    const parsedJson = JSON.parse(rawText);
    if (parsedJson && (parsedJson.netLiquidation || parsedJson.net_liquidation)) {
      return {
        accountId: "account_" + Date.now(),
        accountName: parsedJson.accountName || parsedJson.source || "自訂對帳單帳戶",
        source: parsedJson.source || "文字/JSON 匯入",
        updatedAt: parsedJson.updatedAt || parsedJson.updated_at || new Date().toISOString().slice(0, 16).replace('T', ' '),
        currency: parsedJson.currency || "USD",
        netLiquidation: parseFloat(parsedJson.netLiquidation || parsedJson.net_liquidation || 0),
        positionsValue: parseFloat(parsedJson.positionsValue || parsedJson.gross_position_value || 0),
        marginLoan: parseFloat(parsedJson.marginLoan || parsedJson.margin_loan || 0),
        maintenanceMargin: parseFloat(parsedJson.maintenanceMargin || parsedJson.maintenance_margin || 0),
        excessLiquidity: parseFloat(parsedJson.excessLiquidity || parsedJson.excess_liquidity || 0),
        buyingPower: parseFloat(parsedJson.buyingPower || parsedJson.buying_power || 0),
        borrowingRatio: parseFloat(parsedJson.borrowingRatio || 0) || Number((((parsedJson.marginLoan || parsedJson.margin_loan || 0) / (parsedJson.netLiquidation || parsedJson.net_liquidation || 1)) * 100).toFixed(1)),
        effectiveLeverage: parseFloat(parsedJson.effectiveLeverage || 0) || Number((((parsedJson.positionsValue || parsedJson.gross_position_value || 0) / (parsedJson.netLiquidation || parsedJson.net_liquidation || 1))).toFixed(2)),
        note: parsedJson.note || "由 AI 解析 JSON 輸入生成",
        holdings: parsedJson.holdings || []
      };
    }
  } catch (e) {}

  // Parse Text via Pattern Matching
  const netMatch = rawText.match(/(?:淨值|Net Liquidation|Total)\s*[:：]?\s*([$€NT¥]?\s*[\d,]+(?:\.\d+)?)/i);
  const posMatch = rawText.match(/(?:持倉|Positions|Gross Position|Market Value)\s*[:：]?\s*([$€NT¥]?\s*[\d,]+(?:\.\d+)?)/i);
  const loanMatch = rawText.match(/(?:借款|融資|Loan|Margin Loan)\s*[:：]?\s*([$€NT¥]?\s*[\d,]+(?:\.\d+)?)/i);

  const cleanNum = (str) => str ? parseFloat(str.replace(/[$€NT¥,\s]/g, '')) : 0;

  const netLiquidation = cleanNum(netMatch?.[1]);
  const positionsValue = cleanNum(posMatch?.[1]);
  const marginLoan = cleanNum(loanMatch?.[1]);

  if (netLiquidation > 0 || positionsValue > 0) {
    const net = netLiquidation || (positionsValue - marginLoan);
    return {
      accountId: "account_" + Date.now(),
      accountName: "對帳單貼入帳戶 (" + (rawText.includes('EUR') ? 'EUR' : rawText.includes('USD') ? 'USD' : 'TWD') + ")",
      source: "純文字匯入解析",
      updatedAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
      currency: rawText.includes('EUR') ? 'EUR' : rawText.includes('USD') ? 'USD' : 'TWD',
      netLiquidation: net,
      positionsValue: positionsValue || net + marginLoan,
      marginLoan: marginLoan,
      maintenanceMargin: Number((positionsValue * 0.25).toFixed(2)),
      excessLiquidity: Number((net - positionsValue * 0.25).toFixed(2)),
      buyingPower: Number((net * 4).toFixed(2)),
      borrowingRatio: net > 0 ? Number(((marginLoan / net) * 100).toFixed(1)) : 0,
      effectiveLeverage: net > 0 ? Number(((positionsValue || net) / net).toFixed(2)) : 1.0,
      note: "由對帳單文字對照解析出之關鍵長期記憶紀錄。",
      holdings: []
    };
  }

  return null;
}

if (typeof window !== 'undefined') {
  window.DEMO_PRESETS = DEMO_PRESETS;
  window.getSavedAccounts = getSavedAccounts;
  window.saveAccounts = saveAccounts;
  window.parseRawStatementText = parseRawStatementText;
}
