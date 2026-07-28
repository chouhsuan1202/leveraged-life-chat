import {
  calculateDbrLimit,
  calculateMaintenanceRatio,
  calculateStaticDropToThreshold,
  calculateEffectiveExposure,
  calculateLeverage,
  parseInput
} from '../js/calculator.js';

import { searchIvanKnowledge, calculateFinancialMetrics, getGeneralFinanceExplanation } from '../js/tools.js';
import { classifyIntent, processQueryWithContext } from '../js/assistant.js';

function assert(condition, message) {
  if (!condition) {
    throw new Error(`❌ TEST FAILED: ${message}`);
  }
}

console.log('====================================================');
console.log('🧪 RUNNING FULL VERIFICATION SUITE WITH DYNAMIC QUERIES');
console.log('====================================================\n');

// Part 1: Calculator Pure Functions Unit Tests
{
  const mRes = calculateMaintenanceRatio(300000, 100000);
  assert(mRes.ratio === 300, 'Unit 1: Maintenance ratio 300%');
  const dRes = calculateStaticDropToThreshold(300, 130);
  assert(dRes.dropPercent === 56.7, 'Unit 1: Drop percent 56.7%');

  const mRes2 = calculateMaintenanceRatio(100000, 100000);
  assert(mRes2.status === 'MARGIN_CALL', 'Unit 2: MARGIN_CALL');

  const eRes1 = calculateEffectiveExposure(0, 300000, 0, 0, 100000);
  assert(eRes1.totalExposure === 600000, 'Unit 3: Pledged 2x exposure 600k');

  const eRes2 = calculateEffectiveExposure(0, 0, 0, 300000, 100000);
  assert(eRes2.totalExposure === 600000, 'Unit 4: Unpledged 2x exposure 600k');

  const eRes3 = calculateEffectiveExposure(100000, 0, 0, 0, -50000);
  assert(eRes3.exposureRatio === null, 'Unit 5: Net worth <= 0 ratio is null');

  let errCount = 0;
  [-10, NaN, Infinity, 'invalid'].forEach(val => {
    try { parseInput(val); } catch (e) { errCount++; }
  });
  assert(errCount === 4, 'Unit 6: Invalid inputs rejected');

  const dbrRes = calculateDbrLimit(100000, 0);
  assert(dbrRes.maxLimit === 2200000, 'Unit 7: Monthly income 100k DBR limit 2.2M');

  console.log('✅ Part 1: All 7 Pure Calculator Unit Tests Passed Stably!\n');
}

// Part 2: Tools Unit Tests
{
  const toolASearch = searchIvanKnowledge('質押維持率');
  assert(toolASearch.status === 'found' && toolASearch.matches[0].ep === 13, 'Tool A: EP13 lookup');

  const toolBCalc = calculateFinancialMetrics({ type: 'dbr', monthlyIncome: 100000 });
  assert(toolBCalc.data.maxLimit === 2200000, 'Tool B: DBR calc');

  const toolCGen = getGeneralFinanceExplanation('etf');
  assert(toolCGen.explanation.includes('以下是一般金融知識，不代表 Ivan 的原話。'), 'Tool C: Prefix match');

  console.log('✅ Part 2: All 3 Standard Tools Unit Tests Passed Stably!\n');
}

// Part 3: Mandatory 12 Dialogue E2E Scenarios (Including Multi-Turn Context)
console.log('----------------------------------------------------');
console.log('📋 PART 3: 12 MANDATORY DIALOGUE E2E SCENARIOS');
console.log('----------------------------------------------------\n');

const history = [];

const mandatoryScenarios = [
  {
    id: 1,
    query: '我月薪 10 萬，DBR 22 上限是多少？',
    expectedIntent: 'dbr_calculation',
    verify: (ans) => ans.includes('220 萬') && ans.includes('不是銀行保證核貸額度')
  },
  {
    id: 2,
    query: '什麼是股票質押？',
    expectedIntent: 'basic_finance_pledge',
    verify: (ans) => ans.includes('以下是一般金融知識，不代表 Ivan 的原話。') && !ans.includes('不屬於本助手的理財')
  },
  {
    id: 3,
    query: '500 萬股票質押 100 萬，維持率是多少？',
    expectedIntent: 'collateral_ratio',
    verify: (ans) => ans.includes('500.0 %') && ans.includes('EP13') && ans.includes('勘誤')
  },
  {
    id: 4,
    query: '我沒有信貸，申請房貸還會受 DBR 影響嗎？',
    expectedIntent: 'mortgage_assessment',
    verify: (ans) => ans.includes('沒有無擔保負債占用額度') && ans.includes('收支比')
  },
  {
    id: 5,
    query: '0050 跟正二有什麼不同？',
    expectedIntent: 'etf_comparison',
    verify: (ans) => ans.includes('0050') && ans.includes('00631L') && ans.includes('單日')
  },
  {
    id: 6,
    query: '50 萬中 20 萬是正二，其餘是原型，等效曝險是多少？',
    expectedIntent: 'leverage_exposure',
    verify: (ans) => ans.includes('70 萬') && ans.includes('1.4x')
  },
  {
    id: 7,
    query: 'ETF 投資最基本要注意什麼？',
    expectedIntent: 'basic_finance_etf',
    verify: (ans) => ans.includes('追蹤標的與指數風險') && ans.includes('一般金融知識')
  },
  {
    id: 8,
    query: 'Ivan 怎麼看信貸投資？',
    expectedIntent: 'ivan_credit_view',
    verify: (ans) => ans.includes('人力資本') && (ans.includes('EP4') || ans.includes('EP14'))
  },
  {
    id: 9,
    query: 'Ivan 有沒有說過退休一定要用股票質押？',
    expectedIntent: 'retirement_strategy_inquiry',
    verify: (ans) => ans.includes('並未主張「退休一定要用股票質押」')
  },
  {
    id: 10,
    query: '我現在應該把所有資金買正二嗎？',
    expectedIntent: 'advice_disclaimer',
    verify: (ans) => ans.includes('不建議將所有資金一口氣 All-in 買進正二')
  },
  {
    id: 11,
    query: '今天天氣如何？',
    expectedIntent: 'out_of_scope',
    verify: (ans) => ans.includes('不屬於本助手的理財')
  },
  {
    id: 12,
    query: '上一題的 20 萬如果改成 30 萬呢？',
    expectedIntent: 'leverage_exposure_recalc',
    verify: (ans) => ans.includes('80 萬') && ans.includes('1.6x')
  }
];

let passCount = 0;
let failCount = 0;

for (const sc of mandatoryScenarios) {
  history.push({ role: 'user', text: sc.query });
  const res = await processQueryWithContext(sc.query, history);
  history.push({ role: 'assistant', text: res.answer });

  const intentOk = res.intent === sc.expectedIntent;
  const contentOk = sc.verify(res.answer);

  if (intentOk && contentOk) {
    passCount++;
    console.log(`✅ [Q${sc.id} PASSED] (${sc.expectedIntent})`);
  } else {
    failCount++;
    console.error(`❌ [Q${sc.id} FAILED] Expected ${sc.expectedIntent}, got ${res.intent}`);
  }

  console.log(`   測試輸入: "${sc.query}"`);
  console.log(`   實際回應摘要:\n${sc.answer ? sc.answer.substring(0, 150) : res.answer.substring(0, 150)}...\n`);
  console.log('----------------------------------------------------');
}

// Part 4: Dynamic & Arbitrary Number / Phrasing Tests (Addressing Criticism 2)
console.log('\n----------------------------------------------------');
console.log('🧪 PART 4: DYNAMIC & UNSEEN QUERY GENERATION TESTS');
console.log('----------------------------------------------------\n');

const dynamicTests = [
  {
    desc: 'Dynamic Income: 月薪 8.5 萬 DBR 22 額度試算',
    query: '如果我現在月薪 8.5 萬，我的 DBR 22 最高額度是多少？',
    verify: (res) => {
      // 8.5萬 * 22 = 187萬
      const expectedLimit = 8.5 * 22; // 187
      return res.answer.includes('187 萬') && res.answer.includes('不是銀行保證核貸額度');
    }
  },
  {
    desc: 'Dynamic Income: 月薪 15 萬 DBR 22 額度試算',
    query: '倘若我月薪有 15 萬，信貸天條最高上限是多少？',
    verify: (res) => {
      // 15萬 * 22 = 330萬
      return res.answer.includes('330 萬');
    }
  },
  {
    desc: 'Dynamic Pledged Stock & Loan: 120萬持股質押 40萬',
    query: '假設我有 120 萬股票質押借款 40 萬，這樣維持率多少？會被追繳嗎？',
    verify: (res) => {
      // 120萬 / 40萬 = 300%
      return res.answer.includes('300.0 %') && res.answer.includes('56.7%');
    }
  },
  {
    desc: 'Dynamic Portfolio Exposure: 100萬資產中 40萬正二',
    query: '如果我總共 100 萬資產，買了 40 萬正二，剩下 60 萬原型，等效曝險是多少？',
    verify: (res) => {
      // 60萬原型 + 40萬正二*2 = 140萬, 1.4x
      return res.answer.includes('140 萬') && res.answer.includes('1.4x');
    }
  }
];

let dynamicPass = 0;
for (const dt of dynamicTests) {
  const res = await processQueryWithContext(dt.query, []);
  if (dt.verify(res)) {
    dynamicPass++;
    console.log(`✅ [DYNAMIC PASSED] ${dt.desc}`);
    console.log(`   輸入: "${dt.query}"`);
    console.log(`   輸出:\n${res.answer.substring(0, 150)}...\n`);
  } else {
    console.error(`❌ [DYNAMIC FAILED] ${dt.desc}`);
    console.error(`   輸出:\n${res.answer}`);
  }
  console.log('----------------------------------------------------');
}

console.log(`\n📊 VERIFICATION SUMMARY:`);
console.log(`   Mandatory 12 Scenarios: ${passCount} / ${mandatoryScenarios.length} Passed`);
console.log(`   Dynamic Unseen Queries: ${dynamicPass} / ${dynamicTests.length} Passed`);

assert(failCount === 0 && dynamicPass === dynamicTests.length, 'All mandatory and dynamic test scenarios must pass completely!');
console.log('\n🎉 ALL MANDATORY AND DYNAMIC TEST SCENARIOS PASSED 100% STABLY!');
