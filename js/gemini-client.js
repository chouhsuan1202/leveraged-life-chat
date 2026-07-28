/**
 * Server-Side Gemini REST API Client with Structured Function Calling Loop
 * ZERO Front-End API Key Exposure
 */

import https from 'https';
import { calculateFinancialMetrics, searchIvanKnowledge, getGeneralFinanceExplanation } from './tools.js';

const GEMINI_TOOLS_DECLARATION = [
  {
    function_declarations: [
      {
        name: 'calculateFinancialMetrics',
        description: 'Perform deterministic calculation for DBR 22 limit, maintenance ratio %, static price drop %, or effective leverage exposure ratio.',
        parameters: {
          type: 'OBJECT',
          properties: {
            calcType: { type: 'STRING', enum: ['dbr', 'maintenance', 'exposure'] },
            income: { type: 'NUMBER', description: 'Monthly income in TWD' },
            unsecuredDebt: { type: 'NUMBER', description: 'Existing unsecured debt in TWD' },
            pledgedValue: { type: 'NUMBER', description: 'Total pledged stock market value in TWD' },
            loanBalance: { type: 'NUMBER', description: 'Stock collateral loan balance in TWD' },
            totalAssets: { type: 'NUMBER', description: 'Total stock portfolio assets in TWD' },
            leveragedETFValue: { type: 'NUMBER', description: 'Leveraged 2x ETF value in TWD' },
            targetRate: { type: 'NUMBER', description: 'Target margin ratio threshold (e.g. 130)' }
          },
          required: ['calcType']
        }
      },
      {
        name: 'searchIvanKnowledge',
        description: 'Search Ivan Podcast catalog for episode claims, EP numbers, titles, errata.',
        parameters: {
          type: 'OBJECT',
          properties: {
            query: { type: 'STRING', description: 'Query topic or keyword' }
          },
          required: ['query']
        }
      },
      {
        name: 'getGeneralFinanceExplanation',
        description: 'Get general educational financial explanations when topic is not covered by Ivan podcast.',
        parameters: {
          type: 'OBJECT',
          properties: {
            topic: { type: 'STRING', description: 'General finance topic' }
          },
          required: ['topic']
        }
      }
    ]
  }
];

const SYSTEM_INSTRUCTION = `你是「槓桿人生AI」，一個親切、專業、客觀且遵守紀律的繁體中文理財對話助手。

原則與回應準則：
1. 【嚴禁盲目心算】：任何涉及數字計算（DBR 22 上限、維持率%、靜態可承受跌幅%、1x/2x等效曝險），必須呼叫 calculateFinancialMetrics 工具進行確定性試算。
2. 【資料不足時先追問】：若計算缺乏必要數值（如未提供月薪算 DBR，或未提供股票市值與借款算維持率），先提出一個精準追問，絕對不可以自行捏造範例數字。
3. 【來源標示分級】：
   - 知識庫已包含 Ivan 節目主張：精確標示「📌 Podcast EPxx (description_only)」及勘誤資訊。
   - 知識庫未涵蓋但屬一般理財常識：使用 getGeneralFinanceExplanation 並標示「💡 一般金融知識（非 Ivan 原話）」。
   - 即時法規、銀行授信或商品條款：說明需要查證最新官方發布。
4. 【不給指令】：不提供保證獲利、保證安全或直接買賣個股指令。超出理財範圍時禮貌拒答。`;

function makeHttpsRequest(url, data) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const options = {
      hostname: parsedUrl.hostname,
      port: 443,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            reject(new Error(`JSON Parse Error: ${e.message}`));
          }
        } else {
          reject(new Error(`Gemini API Error ${res.statusCode}: ${body}`));
        }
      });
    });

    req.on('error', err => reject(err));
    req.write(data);
    req.end();
  });
}

/**
 * Call Server-Side Gemini REST API with Function Calling Loop & Session State
 */
export async function callGeminiApiServerSide(userQuery, history = [], sessionState = {}, apiKey = '') {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  const contents = [];

  history.forEach(item => {
    contents.push({
      role: item.role === 'user' ? 'user' : 'model',
      parts: [{ text: item.text || item.content || '' }]
    });
  });

  contents.push({
    role: 'user',
    parts: [{ text: userQuery }]
  });

  const payload = {
    system_instruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
    contents,
    tools: GEMINI_TOOLS_DECLARATION,
    generationConfig: { temperature: 0.2, maxOutputTokens: 1000 }
  };

  let response = await makeHttpsRequest(endpoint, JSON.stringify(payload));
  let candidate = response.candidates?.[0];
  let modelPart = candidate?.content?.parts?.[0];

  // If Gemini requests a tool call
  if (modelPart?.functionCall) {
    const call = modelPart.functionCall;
    const toolName = call.name;
    const args = call.args || {};

    let toolResult;
    if (toolName === 'calculateFinancialMetrics') {
      toolResult = calculateFinancialMetrics(args, sessionState);
    } else if (toolName === 'searchIvanKnowledge') {
      toolResult = searchIvanKnowledge(args.query);
    } else if (toolName === 'getGeneralFinanceExplanation') {
      toolResult = getGeneralFinanceExplanation(args.topic || userQuery);
    }

    contents.push(candidate.content);
    contents.push({
      role: 'user',
      parts: [{
        functionResponse: {
          name: toolName,
          response: { output: toolResult }
        }
      }]
    });

    const secondPayload = {
      system_instruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
      contents,
      tools: GEMINI_TOOLS_DECLARATION,
      generationConfig: { temperature: 0.2, maxOutputTokens: 1000 }
    };

    response = await makeHttpsRequest(endpoint, JSON.stringify(secondPayload));
    candidate = response.candidates?.[0];
    modelPart = candidate?.content?.parts?.[0];
  }

  return {
    mode: 'llm',
    answer: modelPart?.text || '無法取得 AI 答案。',
    sessionState
  };
}
