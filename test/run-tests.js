import http from 'http';
import {
  calculateDbrLimit,
  calculateMaintenanceRatio,
  calculateEffectiveExposure,
  parseNumber
} from '../js/calculator.js';

import { searchIvanKnowledge, calculateFinancialMetrics, getGeneralFinanceExplanation } from '../js/tools.js';
import { processQueryWithContext } from '../js/assistant.js';

function assert(condition, message) {
  if (!condition) {
    throw new Error(`❌ TEST FAILED: ${message}`);
  }
}

function makeHttpRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve({ statusCode: res.statusCode, headers: res.headers, body }));
    });
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

console.log('====================================================');
console.log('🧪 RUNNING COMPREHENSIVE BLACK-BOX & SECURITY SUITE');
console.log('====================================================\n');

// ----------------------------------------------------
// SECTION 1: SERVER SECURITY & HARDENING VERIFICATION (10 TESTS)
// ----------------------------------------------------
console.log('🛡️ SECTION 1: SERVER SECURITY & HARDENING TESTS (10 TESTS)');
console.log('----------------------------------------------------');

let securityPassed = 0;

try {
  // Test 1: Access to .env blocked
  const res1 = await makeHttpRequest({ hostname: 'localhost', port: 3000, path: '/.env', method: 'GET' });
  assert(res1.statusCode === 403, 'S1: Access to .env must be 403 Forbidden');
  securityPassed++;
  console.log('  ✅ [S1 PASSED] Blocked access to /.env (HTTP 403)');

  // Test 2: Access to .git blocked
  const res2 = await makeHttpRequest({ hostname: 'localhost', port: 3000, path: '/.git/config', method: 'GET' });
  assert(res2.statusCode === 403, 'S2: Access to .git must be 403 Forbidden');
  securityPassed++;
  console.log('  ✅ [S2 PASSED] Blocked access to /.git/config (HTTP 403)');

  // Test 3: Access to server.js blocked
  const res3 = await makeHttpRequest({ hostname: 'localhost', port: 3000, path: '/server.js', method: 'GET' });
  assert(res3.statusCode === 403, 'S3: Access to server.js must be 403 Forbidden');
  securityPassed++;
  console.log('  ✅ [S3 PASSED] Blocked access to /server.js (HTTP 403)');

  // Test 4: Access to /test/ path blocked
  const res4 = await makeHttpRequest({ hostname: 'localhost', port: 3000, path: '/test/run-tests.js', method: 'GET' });
  assert(res4.statusCode === 403, 'S4: Access to /test/ must be 403 Forbidden');
  securityPassed++;
  console.log('  ✅ [S4 PASSED] Blocked access to /test/run-tests.js (HTTP 403)');

  // Test 5: Directory Traversal Attempt (../../server.js) blocked
  const res5 = await makeHttpRequest({ hostname: 'localhost', port: 3000, path: '/js/../../server.js', method: 'GET' });
  assert(res5.statusCode === 403, 'S5: Directory traversal must be 403 Forbidden');
  securityPassed++;
  console.log('  ✅ [S5 PASSED] Blocked path traversal attempt /js/../../server.js (HTTP 403)');

  // Test 6: Access to unallowed file package.json blocked
  const res6 = await makeHttpRequest({ hostname: 'localhost', port: 3000, path: '/package.json', method: 'GET' });
  assert(res6.statusCode === 403, 'S6: Access to package.json must be 403 Forbidden');
  securityPassed++;
  console.log('  ✅ [S6 PASSED] Blocked access to /package.json (HTTP 403)');

  // Test 7: Untrusted CORS Origin rejected
  const res7 = await makeHttpRequest({
    hostname: 'localhost',
    port: 3000,
    path: '/api/status',
    method: 'GET',
    headers: { 'Origin': 'http://malicious-site.com' }
  });
  assert(res7.statusCode === 403, 'S7: Untrusted CORS Origin must return HTTP 403');
  securityPassed++;
  console.log('  ✅ [S7 PASSED] Rejected untrusted CORS origin http://malicious-site.com (HTTP 403)');

  // Test 8: Public Allowlist /index.html accessible
  const res8 = await makeHttpRequest({ hostname: 'localhost', port: 3000, path: '/index.html', method: 'GET' });
  assert(res8.statusCode === 200, 'S8: Allowlisted /index.html must return 200 OK');
  securityPassed++;
  console.log('  ✅ [S8 PASSED] Allowed public file /index.html (HTTP 200)');

  // Test 9: Public Allowlist /slides.html accessible
  const res9 = await makeHttpRequest({ hostname: 'localhost', port: 3000, path: '/slides.html', method: 'GET' });
  assert(res9.statusCode === 200, 'S9: Allowlisted /slides.html must return 200 OK');
  securityPassed++;
  console.log('  ✅ [S9 PASSED] Allowed public file /slides.html (HTTP 200)');

  // Test 10: GET /api/status endpoint response format
  const res10 = await makeHttpRequest({ hostname: 'localhost', port: 3000, path: '/api/status', method: 'GET' });
  const statusBody = JSON.parse(res10.body);
  assert(statusBody.mode === 'offline_rules' || statusBody.mode === 'llm', 'S10: Status endpoint must report valid mode');
  securityPassed++;
  console.log(`  ✅ [S10 PASSED] /api/status verified (Mode: ${statusBody.modeText})\n`);
} catch (err) {
  console.error('❌ SECURITY VERIFICATION FAILED:', err.message);
  process.exit(1);
}

// ----------------------------------------------------
// SECTION 2: CALCULATOR PURE FUNCTIONS NUMERIC JSON ASSERTIONS (5 TESTS)
// ----------------------------------------------------
console.log('🧮 SECTION 2: CALCULATOR PURE FUNCTIONS NUMERIC TESTS (5 TESTS)');
console.log('----------------------------------------------------');

{
  // T11: DBR Limit calculation with 80k income
  const d1 = calculateDbrLimit({ income: 80000, unsecuredDebt: 0 });
  assert(d1.maxLimit === 1760000 && d1.remainingLimit === 1760000, 'T11: DBR 80k limit must be 1.76M');
  console.log('  ✅ [T11 PASSED] calculateDbrLimit(80,000) = 1,760,000 max limit');

  // T12: Stock Pledge Maintenance Ratio (200萬持股質押 50萬)
  const m1 = calculateMaintenanceRatio({ pledgedValue: 2000000, loanBalance: 500000, targetRate: 130 });
  assert(m1.maintenanceRatio === 400.0 && m1.staticDropToTarget === 67.5, 'T12: Maintenance 400.0%, drop 67.5%');
  console.log('  ✅ [T12 PASSED] calculateMaintenanceRatio(200萬, 50萬) = 400.0% ratio, 67.5% drop to 130%');

  // T13: Leverage Exposure (100萬資產中 30萬正二)
  const e1 = calculateEffectiveExposure({ totalAssets: 1000000, leveragedETFValue: 300000 });
  assert(e1.totalExposure === 1300000 && e1.exposureRatio === 1.3, 'T13: Total exposure 1.3M, ratio 1.3x');
  console.log('  ✅ [T13 PASSED] calculateEffectiveExposure(100萬, 30萬正二) = 1,300,000 (1.30x)');

  // T14: DBR missing income parameter check
  const d2 = calculateDbrLimit({ income: null });
  assert(d2.status === 'missing_param' && d2.requiredParam === 'income', 'T14: DBR missing income');
  console.log('  ✅ [T14 PASSED] calculateDbrLimit(null) correctly returns missing_param status');

  // T15: Maintenance missing loan balance check
  const m2 = calculateMaintenanceRatio({ pledgedValue: null, loanBalance: null });
  assert(m2.status === 'missing_param', 'T15: Maintenance missing params');
  console.log('  ✅ [T15 PASSED] calculateMaintenanceRatio(null, null) correctly returns missing_param status\n');
}

// ----------------------------------------------------
// SECTION 3: 30 BLACK-BOX DIALOGUE & MULTI-TURN TESTS (30 TESTS)
// ----------------------------------------------------
console.log('📋 SECTION 3: 30 BLACK-BOX DIALOGUE & MULTI-TURN TESTS');
console.log('----------------------------------------------------\n');

const testCases = [
  // --- MANDATORY VERIFICATION QUERIES (1-8) ---
  {
    id: 1,
    desc: 'Mandatory 1: 月薪 8 萬 DBR 上限',
    query: '月薪 8 萬，DBR 上限是多少？',
    verify: (res) => res.answer.includes('176 萬') && res.answer.includes('不是銀行保證核貸額度')
  },
  {
    id: 2,
    desc: 'Mandatory 2: 200 萬設質股票借 50 萬維持率與跌幅',
    query: '200 萬設質股票借 50 萬，維持率是多少？',
    verify: (res) => res.answer.includes('400.0 %') && res.answer.includes('67.5%')
  },
  {
    id: 3,
    desc: 'Mandatory 3: 100 萬資產，其中 30 萬是正二總曝險',
    query: '100 萬資產，其中 30 萬是正二，總曝險是多少？',
    verify: (res) => res.answer.includes('130 萬') && res.answer.includes('1.30x')
  },
  {
    id: 4,
    desc: 'Mandatory 4: 多輪更新 - 把剛才的正二改成 25 萬呢？',
    query: '把剛才的正二改成 25 萬呢？',
    isMultiTurn: true,
    verify: (res) => res.answer.includes('125 萬') && res.answer.includes('1.25x')
  },
  {
    id: 5,
    desc: 'Mandatory 5: S&P 500 ETF 跟全球型 ETF 差在哪？',
    query: 'S&P 500 ETF 跟全球型 ETF 差在哪？',
    verify: (res) => res.answer.includes('以下是一般金融知識，不代表 Ivan 的原話。') && res.answer.includes('區域集中度')
  },
  {
    id: 6,
    desc: 'Mandatory 6: 我該先還信貸還是繼續投資？',
    query: '我該先還信貸還是繼續投資？',
    verify: (res) => res.answer.includes('以下是一般金融知識，不代表 Ivan 的原話。') && res.answer.includes('利率比較')
  },
  {
    id: 7,
    desc: 'Mandatory 7: 股票跌多少會被追繳？',
    query: '股票跌多少會被追繳？',
    verify: (res) => res.answer.includes('130%') && (res.answer.includes('追繳') || res.answer.includes('跌幅'))
  },
  {
    id: 8,
    desc: 'Mandatory 8: Ivan 有談過緊急預備金嗎？',
    query: 'Ivan 有談過緊急預備金嗎？',
    verify: (res) => res.answer.includes('6 至 12 個月') && (res.answer.includes('EP14') || res.answer.includes('EP35'))
  },

  // --- BLACK-BOX DYNAMIC & PHRASING VARIATION QUERIES (9-30) ---
  {
    id: 9,
    desc: 'Dynamic DBR: 月薪 42,000 元信貸上限',
    query: '倘若我每月薪水只有 42,000 元，最高可以借多少信貸？',
    verify: (res) => res.answer.includes('92 萬') || res.answer.includes('92.4')
  },
  {
    id: 10,
    desc: 'Dynamic DBR: 月薪 12.5 萬且已借信貸 50 萬',
    query: '如果我月收入 12.5 萬且已經有信貸 50 萬，我還能借多少？',
    verify: (res) => res.answer.includes('225 萬')
  },
  {
    id: 11,
    desc: 'Missing Param DBR: 沒給月薪只問 DBR',
    query: '幫我算一下 DBR 22 倍天條可以借多少錢？',
    verify: (res) => res.answer.includes('請問您目前的**月收入金額**是多少呢')
  },
  {
    id: 12,
    desc: 'Dynamic Pledge: 350 萬質押借 120 萬',
    query: '350 萬持股向券商質押借款 120 萬，維持率是多少？',
    verify: (res) => res.answer.includes('291.7 %') && res.answer.includes('55.4%')
  },
  {
    id: 13,
    desc: 'Missing Param Pledge: 沒給持股與借款金額問維持率',
    query: '如果我做股票質押，維持率是多少？',
    verify: (res) => res.answer.includes('請提供您的**設質股票總市值**與**質押借款金額**')
  },
  {
    id: 14,
    desc: 'Dynamic Pledge: 80 萬持股質押借 40 萬',
    query: '我的持股 80 萬質押借了 40 萬，維持率算得出來嗎？',
    verify: (res) => res.answer.includes('200.0 %') && res.answer.includes('35.0%')
  },
  {
    id: 15,
    desc: 'Dynamic Exposure: 200 萬資產，其中 80 萬是正二',
    query: '總資產 200 萬，配置 80 萬正二與 120 萬原型，等效曝險是多少？',
    verify: (res) => res.answer.includes('280 萬') && res.answer.includes('1.40x')
  },
  {
    id: 16,
    desc: 'Multi-turn Update: 正二改買 50 萬',
    query: '接續上一題，正二改買 50 萬呢？',
    isMultiTurn: true,
    verify: (res) => res.answer.includes('250 萬') && res.answer.includes('1.25x')
  },
  {
    id: 17,
    desc: 'All-in 2x Exposure Risk: 200 萬資產全買正二',
    query: '200 萬資產全買正二 2x 會怎樣？',
    verify: (res) => res.answer.includes('400 萬') && res.answer.includes('2.00x') && res.answer.includes('已高於 1.5x 目標風控區間')
  },
  {
    id: 18,
    desc: 'Chinglish / English ETF query: Difference between 0050 and 00631L',
    query: 'What is the main difference between 0050 and 00631L?',
    verify: (res) => res.answer.includes('0050') && res.answer.includes('00631L')
  },
  {
    id: 19,
    desc: 'Volatility Decay Explanation',
    query: '槓桿 ETF 的波動衰減要怎麼算？',
    verify: (res) => res.answer.includes('單日') && res.answer.includes('波動')
  },
  {
    id: 20,
    desc: 'Ivan EP13 Knowledge: 借新還舊觀念',
    query: 'Ivan 節目裡面講過質押借新還舊嗎？',
    verify: (res) => res.answer.includes('EP13') || res.answer.includes('借新還舊')
  },
  {
    id: 21,
    desc: 'Ivan EP13 Errata: 500萬質押100萬維持率勘誤',
    query: '請問 500 萬質押 100 萬 EP13 的口誤勘誤是什麼？',
    verify: (res) => res.answer.includes('500%') && res.answer.includes('勘誤')
  },
  {
    id: 22,
    desc: 'Ivan EP14 Knowledge: 信貸談判心法',
    query: '我想知道 Ivan 對於信貸競價談判的建議？',
    verify: (res) => res.answer.includes('先信貸') || res.answer.includes('EP14')
  },
  {
    id: 23,
    desc: 'Retirement Strategy Inquiry',
    query: '退休能不能靠股票質押過活？',
    verify: (res) => res.answer.includes('並未主張「退休一定要用股票質押」')
  },
  {
    id: 24,
    desc: 'Market Drawdown SOP',
    query: '大盤如果回檔 20% 應該要 All-in 嗎？',
    verify: (res) => res.answer.includes('分批加碼') || res.answer.includes('EP35')
  },
  {
    id: 25,
    desc: 'Mortgage DBR Assessment',
    query: '房貸會被 DBR 22 倍限制住嗎？',
    verify: (res) => res.answer.includes('沒有無擔保負債占用額度') && res.answer.includes('收支比')
  },
  {
    id: 26,
    desc: 'Out of scope: 天氣',
    query: '今天台北下雨嗎？',
    verify: (res) => res.answer.includes('不屬於本助手的理財')
  },
  {
    id: 27,
    desc: 'Out of scope: 書籍推薦',
    query: '推薦一本好看的科幻小說',
    verify: (res) => res.answer.includes('不屬於本助手的理財')
  },
  {
    id: 28,
    desc: 'General Finance: 信貸利率比較',
    query: '信貸利率如果 2.2% 跟 6% 差異很大嗎？',
    verify: (res) => res.answer.includes('以下是一般金融知識，不代表 Ivan 的原話。')
  },
  {
    id: 29,
    desc: 'Maintenance Call 120% Risk',
    query: '維持率 120% 會立刻被斷頭嗎？',
    verify: (res) => res.answer.includes('130%') && res.answer.includes('追繳')
  },
  {
    id: 30,
    desc: 'DCA Leverage ETF Advice',
    query: '正二 ETF 適合長期定期定額嗎？',
    verify: (res) => res.answer.includes('波動') || res.answer.includes('1.2x')
  }
];

let testSessionState = {};
let dialogueHistory = [];

let blackBoxPassed = 0;
let blackBoxFailed = 0;

for (const tc of testCases) {
  if (!tc.isMultiTurn) {
    testSessionState = {
      income: null,
      unsecuredDebt: null,
      pledgedValue: null,
      loanBalance: null,
      totalAssets: null,
      leveragedETFValue: null,
      targetRate: 130
    };
    dialogueHistory = [];
  }

  dialogueHistory.push({ role: 'user', text: tc.query });
  const res = await processQueryWithContext(tc.query, dialogueHistory, testSessionState, null);
  dialogueHistory.push({ role: 'assistant', text: res.answer });

  const ok = tc.verify(res);

  if (ok) {
    blackBoxPassed++;
    console.log(`✅ [TEST ${tc.id} PASSED] (${tc.desc})`);
  } else {
    blackBoxFailed++;
    console.error(`❌ [TEST ${tc.id} FAILED] (${tc.desc})`);
    console.error(`   Output text:\n${res.answer}`);
  }
  console.log(`   Q: "${tc.query}"`);
  console.log(`   A: ${res.answer.substring(0, 140)}...\n`);
  console.log('----------------------------------------------------');
}

console.log('\n📊 FINAL VERIFICATION REPORT SUMMARY:');
console.log(`   Section 1 Security Tests: ${securityPassed} / 10 Passed`);
console.log(`   Section 2 Numeric Unit Tests: 5 / 5 Passed`);
console.log(`   Section 3 Black-Box Dialogue Tests: ${blackBoxPassed} / ${testCases.length} Passed`);

assert(securityPassed === 10 && blackBoxFailed === 0, 'All security, numeric, and 30 black-box dialogue tests must pass cleanly!');

console.log('\n🎉 ALL 45 COMPREHENSIVE VERIFICATION TESTS PASSED STABLY!');
