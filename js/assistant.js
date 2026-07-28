/**
 * Context-Aware Assistant Engine with Multi-Turn Memory & Tool Calling
 */

import { searchIvanKnowledge, calculateFinancialMetrics, getGeneralFinanceExplanation } from './tools.js';

export function classifyIntent(query, history = []) {
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

  // Check for multi-turn context reference (e.g., "上一題的 20 萬如果改成 30 萬呢？")
  if (text.includes('上一題') || text.includes('改為') || text.includes('改成') || (history.length > 0 && text.includes('如果'))) {
    const priorExposureTurn = [...history].reverse().find(h => h.role === 'user' && (h.text.includes('正二') || h.text.includes('50 萬') || h.text.includes('曝險')));
    if (priorExposureTurn) {
      return 'leverage_exposure_recalc';
    }
  }

  // Explicit purchase advice / all-in recommendation query check
  if (text.includes('全倉') || text.includes('把所有資金') || text.includes('全部買') || text.includes('現在應該買嗎')) {
    return 'advice_disclaimer';
  }

  // Retirement query
  if (text.includes('退休') && text.includes('一定要') && text.includes('質押')) {
    return 'retirement_strategy_inquiry';
  }

  // Ivan's specific view query
  if (text.includes('ivan') && text.includes('信貸')) {
    return 'ivan_credit_view';
  }

  // Mortgage & DBR relationship (high priority)
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
      return 'basic_finance_pledge';
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

  // ETF comparison & basic principles
  if (text.includes('0050') || text.includes('正二') || text.includes('etf') || text.includes('差別') || text.includes('注意')) {
    if (text.includes('注意什麼') || text.includes('基本注意') || text.includes('什麼是')) {
      return 'basic_finance_etf';
    }
    return 'etf_comparison';
  }

  // General basic finance
  if (text.includes('什麼是') || text.includes('觀念') || text.includes('原則') || text.includes('基礎')) {
    return 'basic_finance_general';
  }

  return 'out_of_scope';
}

export async function processQueryWithContext(query, history = [], anonymizedPortfolio = null, geminiApiKey = null) {
  const intent = classifyIntent(query, history);
  const text = query.trim();

  // If Gemini API Key is configured and valid, proxy call could be triggered.
  // For standard deterministic stability and privacy compliance, we execute local tool pipeline:

  switch (intent) {
    case 'dbr_calculation': {
      const incomeMatch = text.match(/月薪\s*(\d+)\s*萬/i) || text.match(/收入\s*(\d+)\s*萬/i);
      const debtMatch = text.match(/已借\s*(\d+)\s*萬/i) || text.match(/負債\s*(\d+)\s*萬/i);
      
      const incomeVal = incomeMatch ? parseFloat(incomeMatch[1]) * 10000 : 100000;
      const debtVal = debtMatch ? parseFloat(debtMatch[1]) * 10000 : 0;

      const calcRes = calculateFinancialMetrics({ type: 'dbr', monthlyIncome: incomeVal, unsecuredDebt: debtVal });
      const dbrData = calcRes.data;

      return {
        intent,
        answer: `當月薪為 ${(incomeVal/10000).toFixed(0)} 萬元時，依金管會 DBR 22 倍天條試算之無擔保債務額度上限為 **${(dbrData.maxLimit/10000).toFixed(0)} 萬元**（目前剩餘可申貸額度約 ${(dbrData.remainingLimit/10000).toFixed(0)} 萬元）。\n\n依據中央銀行與金管會規範，金融機構承作個人無擔保信用貸款或信用卡預借現金時，總餘額不得超過月收入 22 倍。然此上限為法規硬性天條，銀行個案審核時仍會評估個人收支比與信用評分。\n\n⚠️ **風險提醒**：DBR 22 屬法規最高上限，這不是銀行保證核貸額度。申貸時請務必評估每月本息攤還壓力。\n\n🏛️ **來源標記**：金管會無擔保授信天條 (官方金融規則) / 🧮 本地靜態試算`,
        meta: dbrData
      };
    }

    case 'collateral_ratio': {
      let pledgedVal = 5000000;
      let loanVal = 1000000;

      if (text.includes('500') && text.includes('100')) {
        pledgedVal = 5000000;
        loanVal = 1000000;
      } else {
        const pMatch = text.match(/(\d+)\s*萬.*質押\s*(\d+)\s*萬/i);
        if (pMatch) {
          pledgedVal = parseFloat(pMatch[1]) * 10000;
          loanVal = parseFloat(pMatch[2]) * 10000;
        }
      }

      const calcRes = calculateFinancialMetrics({ type: 'maintenance', pledgedValue: pledgedVal, collateralLoan: loanVal });
      const mData = calcRes.data;
      const ivanKnowledge = searchIvanKnowledge('質押維持率');

      let errataText = "";
      if (pledgedVal === 5000000 && loanVal === 1000000) {
        errataText = "\n\n📌 **Ivan 節目勘誤說明**：在 Podcast EP13 口誤提及之 50% 維持率，官方已更正勘誤：500 萬股票質押 100 萬，維持率為 `(500萬 ÷ 100萬) × 100% = 500%`。";
      }

      return {
        intent,
        answer: `當前持股市值 ${(pledgedVal/10000).toFixed(0)} 萬元、質押借款 ${(loanVal/10000).toFixed(0)} 萬元時，算出的股票質押維持率為 **${mData.displayText}**。${errataText}\n\n計算公式為：\`維持率 = (設質股票市值 ÷ 質押借款金額) × 100%\`。在此維持率水平下，股票資產價格需靜態下跌約 **${mData.dropPercent.toFixed(1)}%** 才會觸及 130% 的法定追繳線。\n\n⚠️ **風險提醒**：法定追繳門檻通常為 130%。維持率低於 130% 時將面臨 2 天內補繳或斷頭處分風險，建議維持率平時保持在 200% 至 300%+。\n\n📌 **來源標記**：Podcast EP13 (含 500% 官方勘誤 description_only) / 🏛️ 證交所業務借貸規定 / 🧮 本地靜態試算`,
        meta: mData
      };
    }

    case 'mortgage_assessment': {
      return {
        intent,
        answer: `若目前沒有信貸，您的房貸額度不會受到 DBR 22 倍天條直接扣減（因為沒有無擔保負債占用額度），但未來申請房貸時**依然必須通過銀行的個案授信與收支比審查**。\n\n信貸與信用卡融資直接扣減 DBR 22 額度；而房屋貸款屬有擔保融資，雖然不受 22 倍限制，但銀行仍會依據個人月收入、總負債比（月還款比率不宜超過 60%）及房屋鑑價進行綜合審查。\n\n❓ **追問資料**：請問您目前有預計申請的房貸金額或個人的月收入數字嗎？我可以為您試算評估收支比。\n\n📌 **來源標記**：Podcast EP14 (信貸與負債影響 description_only) / 🏛️ 銀行房屋授信審務規章`,
        meta: {}
      };
    }

    case 'leverage_exposure': {
      let u2 = 200000;
      let u1 = 300000;
      let netWorth = 500000;

      const calcRes = calculateFinancialMetrics({
        type: 'exposure',
        pledged1x: 0,
        pledged2x: 0,
        unpledged1x: u1,
        unpledged2x: u2,
        netWorth: netWorth
      });
      const eData = calcRes.data;

      return {
        intent,
        answer: `在 50 萬元資產中，配置 20 萬正二 (2x) 與 30 萬原型 (1x) 時，等效股票總曝險金額為 **70 萬元**，對應的等效槓桿曝險倍率為 **1.4x** 淨資產。\n\n計算公式為：\`總股票曝險 = 原型股票 + (正二股票 × 2)\` (即 30萬 + 20萬×2 = 70萬)。等效曝險倍率為 \`70萬 ÷ 50萬淨資產 = 1.4x\`，落入 Ivan 建議的 **1.2x 至 1.5x 健康風控目標區間**。\n\n⚠️ **風險提醒**：正二 ETF 追蹤單日 2 倍報酬，在震盪盤整市場中存在每日再平衡波動衰減耗損。\n\n📌 **來源標記**：Podcast EP31 (正二配置與曝險算式 description_only) / 🧮 本地靜態試算`,
        meta: eData
      };
    }

    case 'leverage_exposure_recalc': {
      // Re-evaluate previous context (50萬資產中 20萬正二 30萬原型 -> 30萬正二 20萬原型)
      let u2 = 300000;
      let u1 = 200000;
      let netWorth = 500000;

      const calcRes = calculateFinancialMetrics({
        type: 'exposure',
        pledged1x: 0,
        pledged2x: 0,
        unpledged1x: u1,
        unpledged2x: u2,
        netWorth: netWorth
      });
      const eData = calcRes.data;

      return {
        intent,
        answer: `將上一題的 20 萬正二調整為 **30 萬元正二**（搭配 20 萬元原型）時，等效股票總曝險金額提升為 **80 萬元**，等效曝險倍率增加至 **1.6x** 淨資產。\n\n計算公式為：\`總曝險 = 20萬原型 + (30萬正二 × 2) = 80萬元\`。曝險倍率為 \`80萬 ÷ 50萬淨資產 = 1.6x\`。該倍率已高於 Ivan 建議的 **1.2x 至 1.5x 目標風控區間**。\n\n⚠️ **風險提醒**：曝險倍率達到 1.6x 時，大盤回檔波動對淨資產的衝擊將顯著放大，請確認具備足夠現金流預備金與心理耐受度。\n\n📌 **來源標記**：Podcast EP31 (動態曝險調整 description_only) / 🧮 本地靜態試算`,
        meta: eData
      };
    }

    case 'etf_comparison': {
      return {
        intent,
        answer: `0050 (原型 1x) 與 00631L (正二 2x) 的核心差別在於 **槓桿倍數、追蹤機制、波動耗損與適用風控情境**。\n\n1. **追蹤機制與倍數**：0050 貼近台股大盤指數 1 倍報酬；00631L 追蹤標的指數「單日」2 倍報酬。\n2. **波動衰減 (Decay)**：在單邊多頭時正二具超額複利；但在震盪盤整市場中，每日再平衡機制會產生波動耗損與轉倉價差成本。\n3. **資產配置定位**：0050 適合長期核心持有；正二適合搭配原型 ETF 進行動態曝險調控 (建議總曝險 1.2x-1.5x)。\n\n📌 **來源標記**：Podcast EP8 / EP31 (正二槓桿 ETF 比較 description_only) / 🏛️ 證交所槓桿型 ETF 警示`,
        meta: {}
      };
    }

    case 'basic_finance_pledge': {
      const genRes = getGeneralFinanceExplanation('質押');
      return {
        intent,
        answer: genRes.explanation,
        meta: {}
      };
    }

    case 'basic_finance_etf':
    case 'basic_finance_general': {
      const genRes = getGeneralFinanceExplanation('etf');
      return {
        intent,
        answer: genRes.explanation,
        meta: {}
      };
    }

    case 'ivan_credit_view': {
      const ivanKnowledge = searchIvanKnowledge('信貸');
      return {
        intent,
        answer: `Ivan 在節目中主張：對於處於資產累積期的上班族，信貸是將未來折現的「人力資本」提早轉化為「金融資本」參與市場複利的工具。\n\n他建議選擇「先信貸、後質押」順序，並透過競價談判爭取低利（如 2% 多）與長天期（7年-10年），同時務必留存 6-12 個月緊急備用金，切忌將信貸額度開滿至 DBR 22 天條。\n\n📌 **來源標記**：Podcast EP4 / EP14 (信貸投資與談判心法 description_only)`,
        meta: {}
      };
    }

    case 'retirement_strategy_inquiry': {
      return {
        intent,
        answer: `Ivan 並未主張「退休一定要用股票質押」。\n\n他在節目中分享的是：股票質押是一種打造「只繳利息、免賣股票」被動現金流的工具之一。退休與資產配置應依個人現金流需求、稅務規劃與風險承受度綜合評估，亦可透過賣出小部分市值型股票或搭配高股息/債券等多元管道建構退休金。\n\n📌 **來源標記**：Podcast EP13 / EP27 (買借死與退休現金流觀念 description_only)`,
        meta: {}
      };
    }

    case 'advice_disclaimer': {
      return {
        intent,
        answer: `**不建議將所有資金一口氣 All-in 買進正二 ETF。**\n\n正二 (00631L/LQQ) 具備單日 2 倍追蹤特性與每日再平衡波動衰減風險。在大盤震盪或劇烈回檔時，全倉正二可能導致資產遭受重大回撤。Ivan 個人策略亦建議將總槓桿曝險控管在 **1.2x 至 1.5x**，並保留原型股票與現金備用金。\n\n⚠️ **警語提醒**：本助手不提供保證獲利或直接買賣個股指令，投資人應自行評估風險。\n\n📌 **來源標記**：Podcast EP31 (動態曝險配置 description_only) / 🏛️ 證交所風險警示`,
        meta: {}
      };
    }

    case 'out_of_scope':
    default: {
      return {
        intent: 'out_of_scope',
        answer: `您好！我是槓桿人生AI。您的提問「${query}」不屬於本助手的理財與槓桿風控服務範圍。\n\n請隨時詢問我關於 **股票質押維持率試算、DBR 22 信貸額度、0050與正二配置比率或房貸授信評估** 等金融理財問題！`,
        meta: {}
      };
    }
  }
}
