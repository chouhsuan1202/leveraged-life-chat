/**
 * Standardized Toolsets for Hybrid Financial Assistant
 * - calculateFinancialMetrics
 * - searchIvanKnowledge
 * - getGeneralFinanceExplanation
 */

import {
  calculateDbrLimit,
  calculateMaintenanceRatio,
  calculateEffectiveExposure,
  parseNumber
} from './calculator.js';

/**
 * Knowledge Base Catalog Mapping (Loaded from 00_知識庫目錄.md)
 */
export const IVAN_KNOWLEDGE_CATALOG = [
  {
    ep: 13,
    title: "股票質押「8大問題」一次解答。教你借錢不用還，越借越有錢！",
    claims: ["質押維持率計算", "500萬質押100萬維持率為500%", "借新還舊只繳利息", "退休被動現金流"],
    verification: "description_only",
    timestamp: null,
    errata: "官方勘誤：EP13 提及資產 500 萬、質押借款 100 萬，維持率為 500%（而非 50%）。"
  },
  {
    ep: 14,
    title: "信貸投資完全指南！談判手法大公開，教你3招談出地板利率！",
    claims: ["信貸與DBR 22天條", "信貸按月本息攤還納入收支比估算", "房貸受個案授信與負債比審查影響", "先信貸後質押"],
    verification: "description_only",
    timestamp: null,
    errata: null
  },
  {
    ep: 4,
    title: "信貸買股是找死？實測 10 年績效：比定期定額多賺 100 萬！揭開「安全槓桿」的秘密。",
    claims: ["人力資本折現為金融資本", "信貸投資法與良性債務"],
    verification: "description_only",
    timestamp: null,
    errata: null
  },
  {
    ep: 8,
    title: "新手必聽!!一集搞懂「什麼是槓桿ETF？」揭密槓桿ETF九年賺12倍的驚人真相!!",
    claims: ["槓桿ETF追蹤單日2倍報酬", "波動耗損數學真相", "正二與原型資產配置"],
    verification: "description_only",
    timestamp: null,
    errata: null
  },
  {
    ep: 31,
    title: "信貸、正二、質押怎麼選？搭配「三階段策略」打造千萬退休金！",
    claims: ["0050與00631L差別", "總股票曝險算式 = 1x + (2x * 2)", "建議總槓桿曝險控在 1.2x 至 1.5x 淨資產"],
    verification: "description_only",
    timestamp: null,
    errata: null
  },
  {
    ep: 22,
    title: "股市大跌該逃嗎？揭密槓桿投資的「真正風險」與 必備的「4 大防禦機制」",
    claims: ["帳面波動不等於斷頭處分風險", "4大保命防禦機制", "維持率保持在 200%-300%+ 安全區"],
    verification: "description_only",
    timestamp: null,
    errata: null
  },
  {
    ep: 35,
    title: "最可怕的不是下跌，是忘記開槓的風險！活下來才是致富之道！",
    claims: ["大盤回檔 15%-20% 分批加碼 SOP", "60日季線趨勢驗證", "預留緊急備用金與未借額度"],
    verification: "description_only",
    timestamp: null,
    errata: null
  },
  {
    ep: 27,
    title: "質押額度滿水位、利息飆漲急著賣股？揭開富人「買借死」金融思維！",
    claims: ["富人買借死思維", "退休質押提領率"],
    verification: "description_only",
    timestamp: null,
    errata: null
  }
];

/**
 * Tool 1: calculateFinancialMetrics
 */
export function calculateFinancialMetrics(params = {}, sessionState = {}) {
  const calcType = params.calcType || params.type;

  // Update session state with newly supplied numeric parameters
  if (params.income !== undefined && params.income !== null) sessionState.income = parseNumber(params.income);
  if (params.unsecuredDebt !== undefined && params.unsecuredDebt !== null) sessionState.unsecuredDebt = parseNumber(params.unsecuredDebt);
  if (params.pledgedValue !== undefined && params.pledgedValue !== null) sessionState.pledgedValue = parseNumber(params.pledgedValue);
  if (params.loanBalance !== undefined && params.loanBalance !== null) sessionState.loanBalance = parseNumber(params.loanBalance);
  if (params.totalAssets !== undefined && params.totalAssets !== null) sessionState.totalAssets = parseNumber(params.totalAssets);
  if (params.leveragedETFValue !== undefined && params.leveragedETFValue !== null) sessionState.leveragedETFValue = parseNumber(params.leveragedETFValue);
  if (params.targetRate !== undefined && params.targetRate !== null) sessionState.targetRate = parseNumber(params.targetRate);

  if (calcType === 'dbr') {
    const result = calculateDbrLimit({
      income: sessionState.income,
      unsecuredDebt: sessionState.unsecuredDebt || 0
    });
    return { tool: 'calculateFinancialMetrics', calcType: 'dbr', result };
  }

  if (calcType === 'maintenance') {
    const result = calculateMaintenanceRatio({
      pledgedValue: sessionState.pledgedValue,
      loanBalance: sessionState.loanBalance,
      targetRate: sessionState.targetRate || 130
    });
    return { tool: 'calculateFinancialMetrics', calcType: 'maintenance', result };
  }

  if (calcType === 'exposure') {
    const result = calculateEffectiveExposure({
      totalAssets: sessionState.totalAssets,
      leveragedETFValue: sessionState.leveragedETFValue || 0
    });
    return { tool: 'calculateFinancialMetrics', calcType: 'exposure', result };
  }

  return { status: 'error', message: '未指定有效的計算類型 (calcType)' };
}

/**
 * Tool 2: searchIvanKnowledge
 */
export function searchIvanKnowledge(query) {
  if (typeof query !== 'string') return { status: 'not_found' };
  const text = query.trim().toLowerCase();

  const matches = IVAN_KNOWLEDGE_CATALOG.filter(item => {
    return item.claims.some(claim => text.includes(claim.toLowerCase())) ||
      (text.includes('質押') && (item.ep === 13 || item.ep === 22 || item.ep === 27)) ||
      (text.includes('信貸') && (item.ep === 14 || item.ep === 4 || item.ep === 31)) ||
      (text.includes('正二') && (item.ep === 8 || item.ep === 31)) ||
      (text.includes('0050') && (item.ep === 8 || item.ep === 31)) ||
      (text.includes('備用金') && (item.ep === 35 || item.ep === 14)) ||
      (text.includes('回檔') && item.ep === 35) ||
      (text.includes('退休') && (item.ep === 13 || item.ep === 27 || item.ep === 31));
  });

  if (matches.length === 0) {
    return { status: 'not_found' };
  }

  return {
    status: 'found',
    matches: matches.map(m => ({
      ep: m.ep,
      title: m.title,
      claims: m.claims,
      verification: m.verification,
      timestamp: m.timestamp,
      errata: m.errata
    }))
  };
}

/**
 * Tool 3: getGeneralFinanceExplanation
 */
export function getGeneralFinanceExplanation(topic) {
  const prefix = "以下是一般金融知識，不代表 Ivan 的原話。";

  const t = (topic || '').toLowerCase();

  if (t.includes('質押') || t.includes('追繳')) {
    return {
      status: 'success',
      topic: '股票質押與追繳機制',
      explanation: `${prefix}\n\n**股票質押與追繳機制說明**：\n1. **定義與營運**：股票質押係投資人以持有股票作為擔保品向金融機構申請融通。期滿可滾動展延，按月僅支付利息。\n2. **追繳觸發**：當擔保品價格下跌導致維持率低於法定門檻（通常為 130%）時，券商將發出追繳通知，投資人需於 2 個交易日內補足擔保品或償還部分借款，否則券商有權強制處分（斷頭）。\n\n⚠️ **官方提醒**：各金融機構之質押成數、開辦費與追繳處分時間依最新契約為準，請參閱證交所業務借貸辦法與金融機構最新公告。`
    };
  }

  if (t.includes('s&p') || t.includes('全球') || t.includes('etf')) {
    return {
      status: 'success',
      topic: 'ETF 類型差異',
      explanation: `${prefix}\n\n**S&P 500 ETF vs 全球型 ETF (如 VT) 主要差異**：\n1. **區域集中度**：S&P 500 ETF (如 VOO, IVV) 100% 集中於美國前 500 大巨頭企業；全球型 ETF (如 VT) 分散佈局至全球數十個國家與近萬家公司。\n2. **報酬與波動**：美股近十年受科技龍頭帶動成長強勁，但承擔單一國家市場風險；全球型 ETF 波動相對平緩，能跟隨全球整體經濟成長。\n\n⚠️ **官方提醒**：ETF 內扣總費用率、成分股權重與配息稅務依投信最新發行公開說明書為準。`
    };
  }

  if (t.includes('信貸') || t.includes('還款') || t.includes('順序')) {
    return {
      status: 'success',
      topic: '負債償還與投資優先順序',
      explanation: `${prefix}\n\n**償還負債 vs 繼續投資 決策框架**：\n1. **利率比較**：若負債利率顯著高於投資預期化年報酬率（例如高利信用卡或高於 5-7% 的借款），應優先償還負債。\n2. **流動性與心理耐受**：優先保留 6-12 個月緊急備用金。若信貸利率較低（如 2%-3% 區間）且心理能承受市場波動，投資人得考慮按期還本息同時參與大盤複利。\n\n⚠️ **官方提醒**：銀行信貸利率、還款條款與個人徵信紀錄因人而異，請務必諮詢專業金融服務。`
    };
  }

  return {
    status: 'success',
    topic: '一般理財觀念',
    explanation: `${prefix}\n\n個人資產配置應評估風險耐受度、現金流穩定性與緊急預備金需求。涉及特定商品利率、法規稅務或銀行授信條件時，需以政府機關（金管會、中央銀行、證交所）及金融機構官方最新公告為準。`
  };
}
