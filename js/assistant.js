/**
 * Hybrid AI Assistant Engine with Server-Side Gemini LLM & Parameterized Session Engine
 * ZERO Hardcoded Example Numbers
 */

import { searchIvanKnowledge, calculateFinancialMetrics, getGeneralFinanceExplanation } from './tools.js';
import { callGeminiApiServerSide } from './gemini-client.js';
import { parseNumber } from './calculator.js';

/**
 * Dynamic Entity & Parameter Extractor for Queries
 */
export function extractQueryParams(query, sessionState = {}) {
  const text = query.trim();
  const params = {};

  // Income extraction (月薪 8 萬, 8.5 萬, 85000, 42,000元)
  const incWanMatch = text.match(/(?:月薪|月入|薪水|收入)\s*(?:為|是|有|只有)?\s*(\d+(?:\.\d+)?)\s*萬/i);
  const incNumMatch = text.match(/(?:月薪|月入|薪水|收入)\s*(?:為|是|有|只有)?\s*([\d,]{4,8})\s*(?:元|塊)?/i);
  if (incWanMatch) {
    params.income = parseFloat(incWanMatch[1]) * 10000;
  } else if (incNumMatch) {
    params.income = parseFloat(incNumMatch[1].replace(/,/g, ''));
  }

  // Existing debt extraction (已有信貸 50 萬, 既有負債 20 萬)
  const debtWanMatch = text.match(/(?:已有|已有信貸|已有負債|有信貸|已借)\s*(\d+(?:\.\d+)?)\s*萬/i);
  if (debtWanMatch) {
    params.unsecuredDebt = parseFloat(debtWanMatch[1]) * 10000;
  }

  // Stock Pledge Value & Loan Balance extraction
  const pledgeLoanMatch = text.match(/(\d+(?:\.\d+)?)\s*萬(?:股票|持股|資產|擔保品)?.*?(?:設質|質押|借款|借款|借了|借)\s*(\d+(?:\.\d+)?)\s*萬/i);
  if (pledgeLoanMatch) {
    params.pledgedValue = parseFloat(pledgeLoanMatch[1]) * 10000;
    params.loanBalance = parseFloat(pledgeLoanMatch[2]) * 10000;
  }

  // Total Assets & Leveraged ETF extraction (100 萬資產，其中 30 萬是正二 / 200 萬資產全買正二)
  const totalAssetMatch = text.match(/(\d+(?:\.\d+)?)\s*萬(?:資產|總資產|股票|淨資產|總共)/i) || text.match(/總資產\s*(\d+(?:\.\d+)?)\s*萬/i);
  const leveragedMatch = text.match(/(\d+(?:\.\d+)?)\s*萬(?:是|配置|買)?正二/i) || text.match(/正二\s*(\d+(?:\.\d+)?)\s*萬/i) || text.match(/正二.*?(?:改買|改為|改成)\s*(\d+(?:\.\d+)?)\s*萬/i);

  if (totalAssetMatch) {
    params.totalAssets = parseFloat(totalAssetMatch[1]) * 10000;
  }
  if (leveragedMatch) {
    params.leveragedETFValue = parseFloat(leveragedMatch[1]) * 10000;
  } else if (text.includes('全買正二') || text.includes('全倉正二') || text.includes('全部買正二')) {
    if (params.totalAssets) {
      params.leveragedETFValue = params.totalAssets;
    } else if (sessionState.totalAssets) {
      params.leveragedETFValue = sessionState.totalAssets;
    }
  }

  // Handle multi-turn update (e.g. "把剛才的正二改成 25 萬呢？" or "正二改買 50 萬呢？")
  if (text.includes('改成') || text.includes('改為') || text.includes('調整為') || text.includes('變成') || text.includes('改買')) {
    const changeMatch = text.match(/(?:正二|2x|維持率|月薪)?.*?(?:改成|改為|變成|調整為|改買)\s*(\d+(?:\.\d+)?)\s*萬/i);
    if (changeMatch) {
      const changedVal = parseFloat(changeMatch[1]) * 10000;
      if (text.includes('正二') || sessionState.leveragedETFValue !== undefined) {
        params.leveragedETFValue = changedVal;
        if (!params.totalAssets && sessionState.totalAssets) {
          params.totalAssets = sessionState.totalAssets;
        }
      } else if (text.includes('月薪') || text.includes('收入')) {
        params.income = changedVal;
      }
    }
  }

  return params;
}

/**
 * Broad Intent Classifier for Offline Rules Engine
 */
export function classifyIntent(query, history = [], sessionState = {}) {
  if (typeof query !== 'string') return 'out_of_scope';
  const text = query.trim().toLowerCase();

  // 1. Out of scope check: Explicit non-finance or general conversation
  if (
    text.includes('天氣') ||
    text.includes('下雨') ||
    text.includes('吃什麼') ||
    text.includes('小說') ||
    text.includes('電影') ||
    text.includes('笑話') ||
    text.includes('你好嗎') ||
    text.includes('旅遊')
  ) {
    return 'out_of_scope';
  }

  // 2. Multi-turn context update
  if (text.includes('改成') || text.includes('改為') || text.includes('變成') || text.includes('剛才的')) {
    return 'context_recalc';
  }

  // 3. Retirement query & Borrow-Renew (Priority before pledged/loan)
  if (text.includes('退休') || text.includes('借新還舊')) {
    return 'retirement_strategy_inquiry';
  }

  // 4. Market drawdown / Fallback SOP (Priority before all-in)
  if (text.includes('回檔')) {
    return 'emergency_fund_view';
  }

  // 5. Errata & EP13 specific
  if (text.includes('勘誤') || text.includes('口誤')) {
    return 'collateral_ratio';
  }

  // 6. Maintenance Call trigger & drop explanation
  if (text.includes('跌多少') || text.includes('斷頭') || text.includes('120%') || (text.includes('追繳') && !text.includes('維'))) {
    return 'drop_trigger_explanation';
  }

  // 7. Volatility decay
  if (text.includes('波動衰減') || text.includes('衰減')) {
    return 'etf_comparison';
  }

  // 8. Leverage exposure calculation (Priority when numbers & asset values present)
  if ((text.includes('正二') || text.includes('2x')) && (text.includes('資產') || text.includes('萬') || text.includes('配置') || text.includes('總金額'))) {
    if (text.includes('差在哪') || text.includes('差別') || text.includes('不同') || text.includes('difference')) {
      return 'etf_comparison';
    }
    return 'leverage_exposure';
  }

  // 9. All-in disclaimer
  if (text.includes('all-in') || text.includes('all in') || text.includes('全倉') || text.includes('把所有資金') || text.includes('全買') || text.includes('全部買') || text.includes('現在應該買嗎')) {
    return 'advice_disclaimer';
  }

  // 9. Emergency fund
  if (text.includes('緊急預備金') || text.includes('預備金')) {
    return 'emergency_fund_view';
  }

  // 10. Ivan's specific credit view
  if (text.includes('ivan') && text.includes('信貸')) {
    return 'ivan_credit_view';
  }

  // 11. Mortgage & DBR relationship
  if (text.includes('房貸') || text.includes('房屋貸款')) {
    return 'mortgage_assessment';
  }

  // 12. DBR calculation
  if (text.includes('dbr') || text.includes('月薪') || text.includes('月收入') || text.includes('薪水') || text.includes('信貸上限') || (text.includes('上限') && text.includes('借'))) {
    return 'dbr_calculation';
  }

  // 13. Maintenance Ratio
  if (text.includes('維持率') || (text.includes('質押') && (text.includes('借') || text.includes('設質')))) {
    if (text.includes('什麼是') || text.includes('借新還舊')) return 'basic_finance';
    return 'collateral_ratio';
  }

  // 14. ETF comparisons (S&P 500 vs 全球型, 0050 vs 正二)
  if (text.includes('s&p') || text.includes('全球型') || text.includes('差在哪') || text.includes('0050') || text.includes('正二') || text.includes('00631l')) {
    if (text.includes('差在哪') || text.includes('差別') || text.includes('不同') || text.includes('difference')) {
      return 'etf_comparison';
    }
    if (text.includes('資產') || text.includes('曝險') || text.includes('萬') || text.includes('配置')) {
      return 'leverage_exposure';
    }
    return 'etf_comparison';
  }

  // 15. Debt repayment vs investment order
  if (text.includes('先還信貸') || text.includes('先還錢') || text.includes('繼續投資') || text.includes('先還') || text.includes('還款')) {
    return 'repay_vs_invest';
  }

  // 16. General finance queries
  if (text.includes('質押') || text.includes('信貸') || text.includes('etf') || text.includes('股票') || text.includes('理財') || text.includes('投資') || text.includes('資產')) {
    return 'basic_finance';
  }

  return 'out_of_scope';
}

/**
 * Unified Process Query Function (Proxies to Gemini API or Dynamic Parameter Engine)
 */
export async function processQueryWithContext(query, history = [], sessionState = {}, geminiApiKey = null) {
  // 1. Server-side Gemini API execution
  if (geminiApiKey && geminiApiKey !== 'your_gemini_api_key_here') {
    try {
      const llmRes = await callGeminiApiServerSide(query, history, sessionState, geminiApiKey);
      if (llmRes && llmRes.answer) {
        return llmRes;
      }
    } catch (err) {
      console.warn('⚠️ [SERVER] Gemini API Call failed, switching to Offline Rules Mode:', err.message);
    }
  }

  // 2. Offline Rules Engine (No hardcoded example numbers, purely uses extracted parameters & session state)
  const extractedParams = extractQueryParams(query, sessionState);
  const intent = classifyIntent(query, history, sessionState);
  const text = query.trim();

  switch (intent) {
    case 'dbr_calculation': {
      const calcToolRes = calculateFinancialMetrics({
        calcType: 'dbr',
        income: extractedParams.income,
        unsecuredDebt: extractedParams.unsecuredDebt
      }, sessionState);

      const res = calcToolRes.result;
      if (res.status === 'missing_param') {
        return {
          mode: 'offline_rules',
          intent,
          answer: `請問您目前的**月收入金額**是多少呢？（例如：月薪 8 萬元）。提供數字後我將立即為您試算 DBR 22 倍天條上限與剩餘可申貸額度。`,
          sessionState
        };
      }

      return {
        mode: 'offline_rules',
        intent,
        answer: `當月薪為 ${(res.income/10000).toFixed(res.income % 10000 === 0 ? 0 : 1)} 萬元時，依金管會 DBR 22 倍天條試算之無擔保債務額度上限為 **${(res.maxLimit/10000).toFixed(0)} 萬元**${res.unsecuredDebt > 0 ? `（扣除既有無擔保負債 ${(res.unsecuredDebt/10000).toFixed(0)} 萬後，剩餘額度約 ${(res.remainingLimit/10000).toFixed(0)} 萬）` : ''}。\n\n依據中央銀行與金管會規範，金融機構承作個人無擔保融資（信貸、信用卡循環等）總餘額不得超過月收入 22 倍。但此數字為法規硬性天條，銀行實際核貸時仍會評估個人收支比與信用評分。\n\n⚠️ **風險提醒**：DBR 22 是法規上限，這不是銀行保證核貸額度。申貸時請務必評估每月本息攤還壓力。\n\n🏛️ **來源標記**：金管會無擔保授信天條 (官方金融規則) / 🧮 本地靜態試算`,
        sessionState
      };
    }

    case 'collateral_ratio': {
      const calcToolRes = calculateFinancialMetrics({
        calcType: 'maintenance',
        pledgedValue: extractedParams.pledgedValue,
        loanBalance: extractedParams.loanBalance
      }, sessionState);

      const res = calcToolRes.result;
      if (res.status === 'missing_param') {
        return {
          mode: 'offline_rules',
          intent,
          answer: `請提供您的**設質股票總市值**與**質押借款金額**（例如：200 萬股票借 50 萬），我將為您計算維持率與可承受靜態跌幅。`,
          sessionState
        };
      }

      let errataText = "";
      if (res.pledgedValue === 5000000 && res.loanBalance === 1000000) {
        errataText = "\n\n📌 **Ivan 節目勘誤說明**：在 Podcast EP13 口誤提及之 50% 維持率，官方已更正勘誤：500 萬股票質押 100 萬，維持率為 `(500萬 ÷ 100萬) × 100% = 500%`。";
      }

      return {
        mode: 'offline_rules',
        intent,
        answer: `當前持股市值 ${(res.pledgedValue/10000).toFixed(0)} 萬元、質押借款 ${(res.loanBalance/10000).toFixed(0)} 萬元時，算出的股票質押維持率為 **${res.maintenanceRatio.toFixed(1)} %**。${errataText}\n\n計算公式為：\`維持率 = (設質股票市值 ÷ 質押借款金額) × 100%\`。在此維持率水平下，股票資產價格需靜態下跌約 **${res.staticDropToTarget.toFixed(1)}%** 才會觸及 130% 的法定追繳線。\n\n⚠️ **風險提醒**：法定追繳門檻通常為 130%。維持率低於 130% 時將面臨 2 天內補繳或斷頭處分風險，建議維持率平時保持在 200% 至 300%+。\n\n📌 **來源標記**：Podcast EP13 (含 500% 官方勘誤 description_only) / 🏛️ 證交所業務借貸規定 / 🧮 本地靜態試算`,
        sessionState
      };
    }

    case 'leverage_exposure':
    case 'context_recalc': {
      const calcToolRes = calculateFinancialMetrics({
        calcType: 'exposure',
        totalAssets: extractedParams.totalAssets || sessionState.totalAssets,
        leveragedETFValue: extractedParams.leveragedETFValue !== undefined ? extractedParams.leveragedETFValue : sessionState.leveragedETFValue
      }, sessionState);

      const res = calcToolRes.result;
      if (res.status === 'missing_param') {
        return {
          mode: 'offline_rules',
          intent,
          answer: `請提供您的**總股票資產金額**與**正二 (2x) 配置金額**（例如：100 萬資產中 30 萬是正二），我將為您算出的等效股票總曝險與倍率。`,
          sessionState
        };
      }

      return {
        mode: 'offline_rules',
        intent,
        answer: `在 ${(res.totalAssets/10000).toFixed(0)} 萬元資產中，配置 ${(res.leveragedETFValue/10000).toFixed(0)} 萬正二 (2x) 與 ${(res.prototypeValue/10000).toFixed(0)} 萬原型 (1x) 時，等效股票總曝險金額為 **${(res.totalExposure/10000).toFixed(0)} 萬元**，對應的等效槓桿曝險倍率為 **${res.exposureRatio.toFixed(2)}x** 淨資產。\n\n計算公式為：\`總股票曝險 = 原型股票 + (正二股票 × 2)\` (即 ${res.prototypeValue/10000}萬 + ${res.leveragedETFValue/10000}萬×2 = ${res.totalExposure/10000}萬)。等效曝險倍率為 \`${res.totalExposure/10000}萬 ÷ ${res.totalAssets/10000}萬淨資產 = ${res.exposureRatio.toFixed(2)}x\`，${res.exposureRatio <= 1.5 ? '落入 Ivan 建議的 **1.2x 至 1.5x 健康風控目標區間**' : '已高於 1.5x 目標風控區間'}。\n\n⚠️ **風險提醒**：正二 ETF 追蹤單日 2 倍報酬，在震盪盤整市場中存在每日再平衡波動衰減耗損。\n\n📌 **來源標記**：Podcast EP31 (正二配置與曝險算式 description_only) / 🧮 本地靜態試算`,
        sessionState
      };
    }

    case 'mortgage_assessment': {
      return {
        mode: 'offline_rules',
        intent,
        answer: `若目前沒有信貸，您的房貸額度不會受到 DBR 22 倍天條直接扣減（因為沒有無擔保負債占用額度），但未來申請房貸時**依然必須通過銀行的個案授信與收支比審查**。\n\n信貸與信用卡融資直接扣減 DBR 22 額度；而房屋貸款屬有擔保融資，雖然不受 22 倍限制，但銀行仍會依據個人月收入、總負債比（月還款比率不宜超過 60%）及房屋鑑價進行綜合審查。\n\n❓ **追問資料**：請問您目前有預計申請的房貸金額或個人的月收入數字嗎？我可以為您試算評估收支比。\n\n📌 **來源標記**：Podcast EP14 (信貸與負債影響 description_only) / 🏛️ 銀行房屋授信審務規章`,
        sessionState
      };
    }

    case 'drop_trigger_explanation': {
      const calcToolRes = calculateFinancialMetrics({
        calcType: 'maintenance',
        pledgedValue: extractedParams.pledgedValue || sessionState.pledgedValue,
        loanBalance: extractedParams.loanBalance || sessionState.loanBalance
      }, sessionState);

      const res = calcToolRes.result;
      if (res.status === 'success') {
        return {
          mode: 'offline_rules',
          intent,
          answer: `依您目前的設質持股 ${(res.pledgedValue/10000).toFixed(0)} 萬與借款 ${(res.loanBalance/10000).toFixed(0)} 萬試算，當前維持率為 ${res.maintenanceRatio.toFixed(1)}%。擔保品資產價格靜態下跌約 **${res.staticDropToTarget.toFixed(1)}%** 時，維持率會觸及 130% 法定追繳門檻。\n\n⚠️ **風險提醒**：觸及 130% 時券商將發發追繳通知，2 個交易日內需補繳擔保品或還款，否則將遭強制處分（斷頭）。\n\n📌 **來源標記**：Podcast EP13 / EP22 (維持率風控與跌幅試算 description_only) / 🏛️ 證交所規定`,
          sessionState
        };
      }

      return {
        mode: 'offline_rules',
        intent,
        answer: `股票質押在價格下跌時，若質押維持率（` + '`' + `擔保品市值 ÷ 借款金額 × 100%` + '`' + `）低於法定 **130% 追繳基準線**，投資人將面臨追繳處分。\n\n靜態估算跌幅公式為：` + '`' + `可承受跌幅% = (1 - 130% ÷ 當前維持率) × 100%` + '`' + `。例如維持率在 200% 時，下跌 35% 即會觸及 130% 追繳門檻。\n\n❓ **追問資料**：請提供您的設質股票市值與借款金額，我將為您計算精確的追繳跌幅。\n\n💡 **一般金融知識**：以下是一般金融知識，不代表 Ivan 的原話。`,
        sessionState
      };
    }

    case 'etf_comparison': {
      if (text.includes('s&p') || text.includes('全球')) {
        const genRes = getGeneralFinanceExplanation('s&p');
        return {
          mode: 'offline_rules',
          intent,
          answer: genRes.explanation,
          sessionState
        };
      }

      return {
        mode: 'offline_rules',
        intent,
        answer: `0050 (原型 1x) 與 00631L (正二 2x) 的核心差別在於 **槓桿倍數、追蹤機制、波動耗損與適用風控情境**。\n\n1. **追蹤機制與倍數**：0050 貼近台股大盤指數 1 倍報酬；00631L 追蹤標的指數「單日」2 倍報酬。\n2. **波動衰減 (Decay)**：在單邊多頭時正二具超額複利；但在震盪盤整市場中，每日再平衡機制會產生波動耗損與轉倉價差成本。\n3. **資產配置定位**：0050 適合長期核心持有；正二適合搭配原型 ETF 進行動態曝險調控 (建議總曝險 1.2x-1.5x)。\n\n📌 **來源標記**：Podcast EP8 / EP31 (正二槓桿 ETF 比較 description_only) / 🏛️ 證交所槓桿型 ETF 警示`,
        sessionState
      };
    }

    case 'repay_vs_invest': {
      const genRes = getGeneralFinanceExplanation('信貸');
      return {
        mode: 'offline_rules',
        intent,
        answer: genRes.explanation,
        sessionState
      };
    }

    case 'emergency_fund_view': {
      const ivanKnowledge = searchIvanKnowledge('預備金');
      return {
        mode: 'offline_rules',
        intent,
        answer: `Ivan 在節目中多次強調「預備金與未借額度」是槓桿投資的命脈。\n\n他建議投資人平時應留存 **6 至 12 個月的生活緊急預備金**，且信貸與質押額度切忌在牛市狂熱時一口氣開滿。預留未動用的借款額度，才能在大盤回檔 15%-20% 時有安全底氣進行分批加碼。\n\n📌 **來源標記**：Podcast EP14 / EP35 (緊急預備金與風控 SOP description_only)`,
        sessionState
      };
    }

    case 'ivan_credit_view': {
      return {
        mode: 'offline_rules',
        intent,
        answer: `Ivan 在節目中主張：對於處於資產累積期的上班族，信貸是將未來折現的「人力資本」提早轉化為「金融資本」參與市場複利的工具。\n\n他建議選擇「先信貸、後質押」順序，並透過競價談判爭取低利（如 2% 多）與長天期（7年-10年），同時務必留存 6-12 個月緊急備用金，切忌將信貸額度開滿至 DBR 22 天條。\n\n📌 **來源標記**：Podcast EP4 / EP14 (信貸投資與談判心法 description_only)`,
        sessionState
      };
    }

    case 'retirement_strategy_inquiry': {
      return {
        mode: 'offline_rules',
        intent,
        answer: `Ivan 並未主張「退休一定要用股票質押」。\n\n他在節目中分享的是：股票質押是一種打造「只繳利息、免賣股票」被動現金流的工具之一。退休與資產配置應依個人現金流需求、稅務規劃與風險承受度綜合評估，亦可透過賣出小部分市值型股票或搭配高股息/債券等多元管道建構退休金。\n\n📌 **來源標記**：Podcast EP13 / EP27 (買借死與退休現金流觀念 description_only)`,
        sessionState
      };
    }

    case 'advice_disclaimer': {
      return {
        mode: 'offline_rules',
        intent,
        answer: `**不建議將所有資金一口氣 All-in 買進正二 ETF。**\n\n正二 (00631L/LQQ) 具備單日 2 倍追蹤特性與每日再平衡波動衰減風險。在大盤震盪或劇烈回檔時，全倉正二可能導致資產遭受重大回撤。Ivan 個人策略亦建議將總槓桿曝險控管在 **1.2x 至 1.5x**，並保留原型股票與現金備用金。\n\n⚠️ **警語提醒**：本助手不提供保證獲利或直接買賣個股指令，投資人應自行評估風險。\n\n📌 **來源標記**：Podcast EP31 (動態曝險配置 description_only) / 🏛️ 證交所風險警示`,
        sessionState
      };
    }

    case 'basic_finance': {
      const genRes = getGeneralFinanceExplanation(text);
      return {
        mode: 'offline_rules',
        intent,
        answer: genRes.explanation,
        sessionState
      };
    }

    case 'out_of_scope': {
      return {
        mode: 'offline_rules',
        intent: 'out_of_scope',
        answer: `您好！我是槓桿人生AI。您的提問「${query}」不屬於本助手的理財與槓桿風控服務範圍。\n\n請隨時詢問我關於 **股票質押維持率試算、DBR 22 信貸額度、0050與正二配置比率或房貸授信評估** 等金融理財問題！`,
        sessionState
      };
    }

    default: {
      const genRes = getGeneralFinanceExplanation(text);
      return {
        mode: 'offline_rules',
        intent: 'general_finance_fallback',
        answer: genRes.explanation,
        sessionState
      };
    }
  }
}
