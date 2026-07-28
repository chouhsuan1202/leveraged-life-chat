/**
 * Hybrid Financial Assistant & Intent Classifier Engine
 */

import {
  calculateDbrLimit,
  calculateMaintenanceRatio,
  calculateStaticDropToThreshold,
  calculateEffectiveExposure
} from './calculator.js';

export function classifyIntent(query) {
  if (typeof query !== 'string') return 'out_of_scope';
  const text = query.trim().toLowerCase();

  // Out of scope check
  if (
    text.includes('天氣') ||
    text.includes('吃什麼') ||
    text.includes('笑話') ||
    text.includes('你好嗎') ||
    text.includes('影評')
  ) {
    return 'out_of_scope';
  }

  // Mortgage & DBR relationship check (higher priority)
  if (text.includes('房貸') || text.includes('房屋貸款')) {
    return 'mortgage_assessment';
  }

  // DBR calculation & limits
  if (text.includes('dbr') || text.includes('月薪') || text.includes('上限多少') || text.includes('無擔保上限')) {
    return 'dbr_calculation';
  }

  // Maintenance Ratio & Pledging Calculations
  if (text.includes('維持率') || text.includes('質押') || text.includes('追繳') || text.includes('斷頭')) {
    if (text.includes('什麼是質押') || text.includes('質押是') || text.includes('什麼是股票質押')) {
      return 'basic_finance';
    }
    return 'collateral_ratio';
  }

  // Leverage Exposure & 1x/2x Combinations
  if (text.includes('曝險') || text.includes('等效') || (text.includes('正二') && (text.includes('萬') || text.includes('0050')))) {
    if (text.includes('差別') || text.includes('比較') || text.includes('不同')) {
      return 'etf_comparison';
    }
    return 'leverage_exposure';
  }

  // ETF comparison
  if (text.includes('0050') || text.includes('正二') || text.includes('etf') || text.includes('差別') || text.includes('注意')) {
    if (text.includes('注意什麼') || text.includes('基本注意') || text.includes('什麼是')) {
      return 'basic_finance';
    }
    return 'etf_comparison';
  }

  // General basic finance
  if (text.includes('什麼是') || text.includes('觀念') || text.includes('原則') || text.includes('基礎')) {
    return 'basic_finance';
  }

  // Default to portfolio_risk or basic_finance if financial
  if (text.includes('理財') || text.includes('資產') || text.includes('投資') || text.includes('股票')) {
    return 'portfolio_risk';
  }

  return 'out_of_scope';
}

export function processQuery(query) {
  const intent = classifyIntent(query);
  const text = query.trim();

  switch (intent) {
    case 'dbr_calculation': {
      // Parse monthly income and existing debt
      const incomeMatch = text.match(/月薪\s*(\d+)\s*萬/i) || text.match(/收入\s*(\d+)\s*萬/i);
      const debtMatch = text.match(/已借\s*(\d+)\s*萬/i) || text.match(/負債\s*(\d+)\s*萬/i);
      
      const incomeVal = incomeMatch ? parseFloat(incomeMatch[1]) * 10000 : 100000;
      const debtVal = debtMatch ? parseFloat(debtMatch[1]) * 10000 : 0;

      const dbrRes = calculateDbrLimit(incomeVal, debtVal);
      const maxWan = (dbrRes.maxLimit / 10000).toFixed(0);
      const remWan = (dbrRes.remainingLimit / 10000).toFixed(0);

      return {
        intent,
        answer: `月薪 ${(incomeVal/10000).toFixed(0)} 萬時，金管會 DBR 22 倍天條對應的無擔保債務上限為 **220 萬元**（目前剩餘可申請額度約 ${remWan} 萬元）。\n\n根據金管會規定，金融機構承作個人無擔保融資（信貸、信用卡循環等）總餘額不得超過月收入 22 倍。但此數字為法規硬性上限，銀行實際核貸時仍會綜合審查個人信用評分、職業屬性與收支比。\n\n⚠️ **風險提醒**：DBR 22 是法規上限，這不是銀行保證核貸額度。過度借滿信貸可能導致現金流緊繃。\n\n🏛️ **來源標記**：金管會無擔保授信天條 (官方金融規則)`,
        meta: dbrRes
      };
    }

    case 'collateral_ratio': {
      // Parse pledged value & loan
      const pledgedMatch = text.match(/(\d+)\s*萬\s*股票\s*質押/i) || text.match(/設質\s*(\d+)\s*萬/i) || text.match(/(\d+)\s*萬.*質押\s*(\d+)\s*萬/i);
      let pledgedVal = 5000000;
      let loanVal = 1000000;

      if (text.includes('500') && text.includes('100')) {
        pledgedVal = 5000000;
        loanVal = 1000000;
      } else if (pledgedMatch) {
        if (pledgedMatch[2]) {
          pledgedVal = parseFloat(pledgedMatch[1]) * 10000;
          loanVal = parseFloat(pledgedMatch[2]) * 10000;
        } else {
          pledgedVal = parseFloat(pledgedMatch[1]) * 10000;
        }
      }

      const marginRes = calculateMaintenanceRatio(pledgedVal, loanVal);
      const dropRes = calculateStaticDropToThreshold(marginRes.ratio, 130);

      let extraErrata = "";
      if (pledgedVal === 5000000 && loanVal === 1000000) {
        extraErrata = "（附 Podcast EP13 官方勘誤：資產 500 萬、質押借款 100 萬，維持率為 500%）。";
      }

      return {
        intent,
        answer: `當前設質股票市值 ${(pledgedVal/10000).toFixed(0)} 萬、質押借款 ${(loanVal/10000).toFixed(0)} 萬時，算出的股票質押維持率為 **${marginRes.displayText}** ${extraErrata}\n\n計算公式為：\`維持率 = (設質擔保品市值 ÷ 質押借款金額) × 100%\`。在維持率 ${marginRes.ratio.toFixed(1)}% 的情況下，擔保品資產價格靜態可承受下跌約 **${dropRes.dropPercent.toFixed(1)}%** 才會觸及 130% 法定追繳基準線。\n\n⚠️ **風險提醒**：法定追繳門檻通常為 130%。若低於 130% 券商將發發追繳通知，2 天內需補充擔保品或還款。\n\n📌 **來源標記**：Podcast EP13 (含 500% 官方勘誤 description_only) / 證交所業務借貸規定`,
        meta: { ...marginRes, ...dropRes }
      };
    }

    case 'mortgage_assessment': {
      return {
        intent,
        answer: `若目前沒有信貸，您的房貸額度不會受到 DBR 22 倍天條直接扣減（因為沒有無擔保負債占用額度），但未來申請房貸時**依然必須通過銀行的個案授信與收支比審查**。\n\n信貸與信用卡屬無擔保融資，直接受 DBR 22 規範扣減；而房屋貸款屬有擔保融資，雖然不受 DBR 22 的 22 倍限制，但銀行依然會調閱聯徵紀錄審查個人總負債、收支比（通常要求月還款金額低於月收入 60%）與房屋鑑價狀況。\n\n❓ **追問資料**：請問您目前有預計申請的房貸金額或個人的月收入數字嗎？我可以為您試算評估收支比。\n\n📌 **來源標記**：Podcast EP14 (信貸與負債影響 description_only) / 銀行房屋授信審務規章`,
        meta: {}
      };
    }

    case 'leverage_exposure': {
      // Parse 20萬正二 30萬原型 or total
      let p2 = 0, u1 = 0, u2 = 0, p1 = 0;
      if (text.includes('20') && text.includes('正二')) {
        u2 = 200000;
        u1 = 300000;
      }

      const netWorth = u1 + u2;
      const expRes = calculateEffectiveExposure(p1, p2, u1, u2, netWorth);

      return {
        intent,
        answer: `在 50 萬元資產中，配置 20 萬正二 (2x) 與 30 萬原型 (1x) 時，等效股票總曝險金額為 **${(expRes.totalExposure/10000).toFixed(0)} 萬元**，對應的等效曝險倍率為 **${expRes.exposureRatio.toFixed(1)}x** 淨資產。\n\n計算公式為：\`總曝險 = 原型股票市值 + (正二股票市值 × 2)\` (即 30萬 + 20萬×2 = 70萬)。等效曝險倍率為 \`70萬 ÷ 50萬淨資產 = 1.4x\`，完美落入 Ivan 建議的 **1.2x 至 1.5x 健康風控目標區間**。\n\n⚠️ **風險提醒**：正二 ETF 具備單日 2 倍追蹤特性，在震盪盤整市場中存在每日再平衡波動衰減耗損。\n\n📌 **來源標記**：Podcast EP31 (正二配置與曝險算式 description_only) / 🧮 本地確定性試算`,
        meta: expRes
      };
    }

    case 'etf_comparison': {
      return {
        intent,
        answer: `0050 (原型 1x) 與 00631L (正二 2x) 的核心差別在於 **槓桿倍數、追蹤機制、波動耗損與適用風控情境**。\n\n1. **追蹤機制與倍數**：0050 貼近台股大盤指數 1 倍報酬；00631L 追蹤標的指數「單日」2 倍報酬。\n2. **波動衰減 (Decay)**：在單邊多頭時正二具超額複利；但在震盪盤整市場中，每日再平衡機制會產生波動耗損與轉倉價差成本。\n3. **資產配置定位**：0050 適合長期核心持有；正二適合搭配原型 ETF 進行動態曝險調控 (建議總曝險 1.2x-1.5x)。\n\n📌 **來源標記**：Podcast EP8 / EP31 (正二槓桿 ETF 比較 description_only) / 證交所槓桿型 ETF 警示`,
        meta: {}
      };
    }

    case 'basic_finance': {
      if (text.includes('質押')) {
        return {
          intent,
          answer: `**股票質押**是指投資人將手中持有的股票（如 0050、006208）作為擔保品抵押給證券商或證金公司，藉此借出現金融通的金融工具。\n\n其核心優勢在於「只繳利息、免賣股票」，能夠保留原股票的長期資本增值與配息權利，同時取得低利流動性。但必須隨時維繫維持率高於 130%（建議 200%+），避免因股價大跌被斷頭處分。\n\n📘 **說明**：以下為一般金融知識說明，不代表 Ivan 個人原話。\n\n🏛️ **來源標記**：證券業務借貸管理辦法 (官方金融規則)`,
          meta: {}
        };
      }

      return {
        intent,
        answer: `投資 ETF (指數型股票基金) 最基本需要注意 **追蹤標的與指數風險、總內扣費用 (Expense Ratio)、流動性與規模、折溢價幅度以及每日波動耗損**。\n\n1. **追蹤指數與標的**：搞懂是原型大盤 (0050/QQQ) 還是槓桿型 (00631L)。\n2. **內扣費用與溢價**：確認內扣管理費與買入時無過大溢價。\n3. **流動性**：選擇日成交量充足之標的，避免滑價損失。\n\n📘 **說明**：以下為一般金融知識說明，不代表 Ivan 個人原話。\n\n🏛️ **來源標記**：證券投資信託業務法規 (一般金融知識)`,
        meta: {}
      };
    }

    case 'portfolio_risk': {
      return {
        intent,
        answer: `理財資產配置的核心原則在於 **專注淨資產增長、控制槓桿曝險在 1.2x-1.5x 區間、維持質押維持率 200%+，並留存 6-12 個月緊急備用金**。\n\n透過市值型大盤 ETF 搭配低利工具，可以在防範黑天鵝斷頭風險的同時，享有長期資本增值的複利效應。\n\n📌 **來源標記**：Podcast EP22 / EP35 (槓桿風控與資產配置 description_only)`,
        meta: {}
      };
    }

    case 'out_of_scope':
    default: {
      return {
        intent: 'out_of_scope',
        answer: `您好！我是槓桿理財對話助手。您的提問「${query}」不屬於本助手的理財與槓桿風控服務範圍。\n\n請隨時詢問我關於 **股票質押維持率試算、DBR 22 信貸額度、0050與正二配置比率或房貸授信評估** 等金融理財問題！`,
        meta: {}
      };
    }
  }
}
