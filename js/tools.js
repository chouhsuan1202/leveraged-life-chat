/**
 * Standardized Toolsets for Financial Assistant
 * - searchIvanKnowledge
 * - calculateFinancialMetrics
 * - getGeneralFinanceExplanation
 */

import {
  calculateDbrLimit,
  calculateMaintenanceRatio,
  calculateStaticDropToThreshold,
  calculateEffectiveExposure,
  calculateLeverage
} from './calculator.js';

/**
 * Knowledge Base Catalog & Mapping (Loaded from 00_知識庫目錄.md)
 */
const IVAN_KNOWLEDGE_CATALOG = [
  {
    ep: 13,
    title: "股票質押「8大問題」一次解答。教你借錢不用還，越借越有錢！",
    claims: ["質押維持率計算", "500萬質押100萬維持率為500%", "借新還舊只繳利息"],
    verification: "description_only",
    timestamp: null,
    errata: "官方勘誤：EP13 提及資產 500 萬、質押借款 100 萬，維持率為 500%（而非 50%）。"
  },
  {
    ep: 14,
    title: "信貸投資完全指南！談判手法大公開，教你3招談出地板利率！",
    claims: ["信貸與DBR 22天條", "信貸按月本息攤還影響收支比", "房貸受收支比與負債比個案審查影響"],
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
    claims: ["0050與00631L差異", "總股票曝險算式 = 1x + (2x * 2)", "建議總曝險控在 1.2x 至 1.5x 淨資產"],
    verification: "description_only",
    timestamp: null,
    errata: null
  },
  {
    ep: 22,
    title: "股市大跌該逃嗎？揭密槓桿投資的「真正風險」與 必備的「4 大防禦機制」",
    claims: ["帳面波動不等於斷頭風險", "4大保命防禦機制", "維持率控在 200%-300%+ 安全區"],
    verification: "description_only",
    timestamp: null,
    errata: null
  },
  {
    ep: 35,
    title: "最可怕的不是下跌，是忘記開槓的風險！活下來才是致富之道！",
    claims: ["大盤回檔 15%-20% 分批加碼 SOP", "60日季線趨勢驗證", "預留備用金不開滿槓桿"],
    verification: "description_only",
    timestamp: null,
    errata: null
  }
];

/**
 * Tool A: searchIvanKnowledge
 */
export function searchIvanKnowledge(query, context = []) {
  if (typeof query !== 'string') return { status: 'not_found' };
  const text = query.toLowerCase();

  const results = IVAN_KNOWLEDGE_CATALOG.filter(item => {
    return item.claims.some(claim => text.includes(claim.toLowerCase())) ||
      (text.includes('質押') && (item.ep === 13 || item.ep === 22)) ||
      (text.includes('信貸') && (item.ep === 14 || item.ep === 31)) ||
      (text.includes('正二') && (item.ep === 8 || item.ep === 31)) ||
      (text.includes('0050') && (item.ep === 8 || item.ep === 31)) ||
      (text.includes('回檔') && item.ep === 35) ||
      (text.includes('退休') && (item.ep === 31 || item.ep === 13));
  });

  if (results.length === 0) {
    return { status: 'not_found' };
  }

  return {
    status: 'found',
    matches: results.map(r => ({
      ep: r.ep,
      title: r.title,
      claims: r.claims,
      verification: r.verification,
      timestamp: r.timestamp,
      errata: r.errata
    }))
  };
}

/**
 * Tool B: calculateFinancialMetrics
 */
export function calculateFinancialMetrics(inputs) {
  try {
    if (inputs.type === 'dbr') {
      const res = calculateDbrLimit(inputs.monthlyIncome, inputs.unsecuredDebt || 0);
      return { status: 'success', type: 'dbr', data: res };
    }
    
    if (inputs.type === 'maintenance') {
      const mRes = calculateMaintenanceRatio(inputs.pledgedValue, inputs.collateralLoan);
      const dropRes = mRes.ratio !== null ? calculateStaticDropToThreshold(mRes.ratio, 130) : { dropPercent: null };
      return { status: 'success', type: 'maintenance', data: { ...mRes, ...dropRes } };
    }

    if (inputs.type === 'exposure') {
      const eRes = calculateEffectiveExposure(
        inputs.pledged1x || 0,
        inputs.pledged2x || 0,
        inputs.unpledged1x || 0,
        inputs.unpledged2x || 0,
        inputs.netWorth || 0
      );
      return { status: 'success', type: 'exposure', data: eRes };
    }

    const fullRes = calculateLeverage(inputs);
    return { status: 'success', type: 'full', data: fullRes };
  } catch (err) {
    return { status: 'error', message: err.message };
  }
}

/**
 * Tool C: getGeneralFinanceExplanation
 */
export function getGeneralFinanceExplanation(topic) {
  const prefix = "以下是一般金融知識，不代表 Ivan 的原話。";

  if (topic.includes('質押')) {
    return {
      status: 'success',
      explanation: `${prefix}\n\n**股票質押**為投資人以名下股票向金融機構（券商/銀行/證金公司）進行擔保借款之金融行為。借款人可按月僅支付利息，免於出售持股，以維持原股票之資本增值與配息權益。\n\n⚠️ **官方提醒**：維持率需維持於法定追繳線（通常為 130%）以上。質押利率、可借成數及規費依各金融機構最新規定為準，申辦前請參閱官方公告。`
    };
  }

  if (topic.includes('etf')) {
    return {
      status: 'success',
      explanation: `${prefix}\n\n**ETF (指數型股票基金) 投資基礎注意事項**：\n1. **追蹤標的與指數風險**：區分原型（追蹤指數1倍）與槓桿型（追蹤單日倍數）。\n2. **總內扣費用率 (Expense Ratio)**：包含管理費與經理費，直接自基金淨值中扣除。\n3. **流動性與折溢價**：關注日均交易量與市價相較淨值之折溢價幅度。\n\n⚠️ **官方提醒**：相關稅務（二代健保/股利所得）、成分股調整及各投信規定可能有所變動，請參考證期局與投信官網。`
    };
  }

  return {
    status: 'success',
    explanation: `${prefix}\n\n個人理財觀念應涵蓋資產負債管理、緊急預備金留存、風險控制與多元資產配置。涉及稅務、法規或具體商品條款時，應以金融監管機構（如金管會、中央銀行、證交所）之最新規範為準。`
  };
}
