import {
  calculateDbrLimit,
  calculateMaintenanceRatio,
  calculateStaticDropToThreshold,
  calculateEffectiveExposure,
  calculateLeverage,
  parseInput
} from '../js/calculator.js';

import { classifyIntent, processQuery } from '../js/assistant.js';

function assert(condition, message) {
  if (!condition) {
    throw new Error(`❌ TEST FAILED: ${message}`);
  }
}

console.log('====================================================');
console.log('🧪 RUNNING VERIFICATION & HYBRID ASSISTANT TEST SUITE');
console.log('====================================================\n');

// Part 1: Calculator Pure Functions Unit Tests
{
  // Test 1: Pledged 300,000, Loan 100,000 => Margin Ratio 300%
  const mRes = calculateMaintenanceRatio(300000, 100000);
  assert(mRes.ratio === 300, 'Test 1: Maintenance ratio must be 300%');
  
  const dRes = calculateStaticDropToThreshold(300, 130);
  assert(dRes.dropPercent === 56.7, 'Test 1: Drop percent must be 56.7%');
  console.log('✅ Unit Test 1 Passed: calculateMaintenanceRatio(300k, 100k) => 300%, Drop 56.7%');

  // Test 2: Pledged 100,000, Loan 100,000 => Margin Call (<130%), 0.0% drop
  const mRes2 = calculateMaintenanceRatio(100000, 100000);
  assert(mRes2.status === 'MARGIN_CALL', 'Test 2: Status must be MARGIN_CALL');
  const dRes2 = calculateStaticDropToThreshold(100, 130);
  assert(dRes2.dropPercent === 0.0, 'Test 2: Drop percent must be 0.0%');
  console.log('✅ Unit Test 2 Passed: calculateMaintenanceRatio(100k, 100k) => MARGIN_CALL');

  // Test 3: Pledged 2x 300,000 => Exposure 600,000
  const eRes1 = calculateEffectiveExposure(0, 300000, 0, 0, 100000);
  assert(eRes1.totalExposure === 600000, 'Test 3: Pledged 2x exposure should be 600k');
  console.log('✅ Unit Test 3 Passed: Pledged 2x 300k => 600k Exposure');

  // Test 4: Unpledged 2x 300,000 => Exposure 600,000
  const eRes2 = calculateEffectiveExposure(0, 0, 0, 300000, 100000);
  assert(eRes2.totalExposure === 600000, 'Test 4: Unpledged 2x exposure should be 600k');
  console.log('✅ Unit Test 4 Passed: Unpledged 2x 300k => 600k Exposure');

  // Test 5: Net Worth <= 0 => exposureRatio is null
  const eRes3 = calculateEffectiveExposure(100000, 0, 0, 0, -50000);
  assert(eRes3.exposureRatio === null, 'Test 5: Exposure ratio must be null when Net Worth <= 0');
  console.log('✅ Unit Test 5 Passed: Net Worth <= 0 => exposureRatio is null');

  // Test 6: Input validation
  let errCount = 0;
  [-10, NaN, Infinity, 'invalid'].forEach(val => {
    try { parseInput(val); } catch (e) { errCount++; }
  });
  assert(errCount === 4, 'Test 6: Invalid inputs must throw error');
  console.log('✅ Unit Test 6 Passed: Invalid inputs (negative, NaN, Infinity) rejected');

  // Test 7: DBR Limit Calculation
  const dbrRes = calculateDbrLimit(100000, 0);
  assert(dbrRes.maxLimit === 2200000, 'Test 7: Monthly income 100k => DBR 22 max limit 2,200,000');
  console.log('✅ Unit Test 7 Passed: calculateDbrLimit(100k) => 2.2M Max Limit');
}

console.log('\n----------------------------------------------------');
console.log('📋 PART 2: 8 MANDATORY NATURAL QUERY E2E TESTS');
console.log('----------------------------------------------------\n');

const testCases = [
  {
    id: 'E1',
    query: '我月薪 10 萬，DBR 22 上限多少？',
    expectedIntent: 'dbr_calculation',
    check: (res) => res.answer.includes('220 萬') && res.answer.includes('不是銀行保證核貸額度')
  },
  {
    id: 'E2',
    query: '什麼是股票質押？',
    expectedIntent: 'basic_finance',
    check: (res) => res.answer.includes('一般金融知識') && !res.answer.includes('無精確匹配紀錄')
  },
  {
    id: 'E3',
    query: '500 萬股票質押 100 萬，維持率多少？',
    expectedIntent: 'collateral_ratio',
    check: (res) => res.answer.includes('500.0 %') && res.answer.includes('EP13 官方勘誤')
  },
  {
    id: 'E4',
    query: '沒有信貸，房貸還受 DBR 影響嗎？',
    expectedIntent: 'mortgage_assessment',
    check: (res) => res.answer.includes('沒有無擔保負債') && res.answer.includes('收支比')
  },
  {
    id: 'E5',
    query: '0050 跟正二有什麼差別？',
    expectedIntent: 'etf_comparison',
    check: (res) => res.answer.includes('0050') && res.answer.includes('00631L') && res.answer.includes('單日')
  },
  {
    id: 'E6',
    query: '50 萬中 20 萬正二，其餘 30 萬原型，等效曝險多少？',
    expectedIntent: 'leverage_exposure',
    check: (res) => res.answer.includes('70 萬') && res.answer.includes('1.4x')
  },
  {
    id: 'E7',
    query: 'ETF 最基本要注意什麼？',
    expectedIntent: 'basic_finance',
    check: (res) => res.answer.includes('基本需要注意') && !res.answer.includes('無精確匹配紀錄')
  },
  {
    id: 'E8',
    query: '今天天氣如何？',
    expectedIntent: 'out_of_scope',
    check: (res) => res.answer.includes('不屬於本助手的理財')
  }
];

let testPassedCount = 0;
const e2eOutputs = [];

testCases.forEach(tc => {
  const res = processQuery(tc.query);
  assert(res.intent === tc.expectedIntent, `Query [${tc.id}] expected intent ${tc.expectedIntent}, got ${res.intent}`);
  assert(tc.check(res), `Query [${tc.id}] output failed verification assertion`);
  
  testPassedCount++;
  e2eOutputs.push({
    id: tc.id,
    query: tc.query,
    intent: res.intent,
    answer: res.answer
  });

  console.log(`📌 [${tc.id}] 測試輸入: "${tc.query}"`);
  console.log(`🎯 分類意圖: ${res.intent}`);
  console.log(`💬 實際輸出回應:\n${res.answer}\n`);
  console.log('----------------------------------------------------');
});

console.log(`\n🎉 ALL 8 MANDATORY NATURAL DIALOGUE E2E TESTS PASSED (${testPassedCount}/8)!`);
