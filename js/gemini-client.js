/**
 * Gemini REST API Client with Function Calling & RAG Integration
 */

import https from 'https';
import { searchIvanKnowledge, calculateFinancialMetrics, getGeneralFinanceExplanation } from './tools.js';

const GEMINI_TOOLS_DECLARATION = [
  {
    function_declarations: [
      {
        name: 'calculateFinancialMetrics',
        description: 'Calculate DBR 22 loan limit, stock pledge maintenance ratio, static price drop %, or effective stock leverage exposure.',
        parameters: {
          type: 'OBJECT',
          properties: {
            type: { type: 'STRING', enum: ['dbr', 'maintenance', 'exposure', 'full'] },
            monthlyIncome: { type: 'NUMBER', description: 'Monthly income in TWD' },
            unsecuredDebt: { type: 'NUMBER', description: 'Existing unsecured debt in TWD' },
            pledgedValue: { type: 'NUMBER', description: 'Total pledged stock market value in TWD' },
            collateralLoan: { type: 'NUMBER', description: 'Stock collateral loan amount in TWD' },
            pledged1x: { type: 'NUMBER', description: 'Pledged 1x stock value' },
            pledged2x: { type: 'NUMBER', description: 'Pledged 2x ETF value' },
            unpledged1x: { type: 'NUMBER', description: 'Unpledged 1x stock value' },
            unpledged2x: { type: 'NUMBER', description: 'Unpledged 2x ETF value' },
            netWorth: { type: 'NUMBER', description: 'Total net worth in TWD' }
          },
          required: ['type']
        }
      },
      {
        name: 'searchIvanKnowledge',
        description: 'Search Ivan Podcast knowledge base for claims, episode titles, EP numbers, timestamps, errata.',
        parameters: {
          type: 'OBJECT',
          properties: {
            query: { type: 'STRING', description: 'Search term or topic' }
          },
          required: ['query']
        }
      },
      {
        name: 'getGeneralFinanceExplanation',
        description: 'Get general educational financial explanations for topics not explicitly covered by Ivan Podcast.',
        parameters: {
          type: 'OBJECT',
          properties: {
            topic: { type: 'STRING', description: 'Financial topic' }
          },
          required: ['topic']
        }
      }
    ]
  }
];

const SYSTEM_INSTRUCTION = `你是「槓桿人生AI」，一個親切專業、客觀謹慎的繁體中文理財對話助手。

原則與回覆要求：
1. 涉及任何數字計算（DBR 22 上限、質押維持率%、靜態可承受跌幅%、1x/2x等效曝險倍率），必須優先呼叫 calculateFinancialMetrics 工具進行確定性運算，不得手動心算。
2. 涉及 Ivan 觀點或 Podcast 內容時，優先呼叫 searchIvanKnowledge 查詢相關集數與勘誤（如 EP13 維持率 500% 勘誤）。
3. 當問題屬於一般金融知識且 Ivan 節目未涵蓋時，呼叫 getGeneralFinanceExplanation 取得說明，開頭必須標明「以下是一般金融知識，不代表 Ivan 的原話。」。
4. 回答結構直接、清晰，通常包含 2~4 個短段落。
5. 必須標記來源標籤：📌 Ivan 觀點 / 🏛️ 官方金融規則 / 💡 一般金融知識 / 🧮 本地靜態試算。
6. 不提供保證獲利或直接買賣指令；當資訊不足時提出一個精準追問；超出理財範圍時禮貌拒答。`;

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
          reject(new Error(`API HTTP Error ${res.statusCode}: ${body}`));
        }
      });
    });

    req.on('error', err => reject(err));
    req.write(data);
    req.end();
  });
}

/**
 * Call Gemini API with Tool Call Loop
 */
export async function callGeminiApi(userQuery, history = [], apiKey) {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  // Format Contents Array
  const contents = [];

  // Add conversation history
  history.forEach(item => {
    contents.push({
      role: item.role === 'user' ? 'user' : 'model',
      parts: [{ text: item.text || item.content || '' }]
    });
  });

  // Add current user prompt
  contents.push({
    role: 'user',
    parts: [{ text: userQuery }]
  });

  const payload = {
    system_instruction: {
      parts: [{ text: SYSTEM_INSTRUCTION }]
    },
    contents,
    tools: GEMINI_TOOLS_DECLARATION,
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 1000
    }
  };

  // Turn 1: Call Gemini
  let response = await makeHttpsRequest(endpoint, JSON.stringify(payload));
  let candidate = response.candidates?.[0];
  let modelPart = candidate?.content?.parts?.[0];

  // If Gemini requests Function Call
  if (modelPart?.functionCall) {
    const call = modelPart.functionCall;
    const toolName = call.name;
    const args = call.args || {};

    let toolResult;
    if (toolName === 'calculateFinancialMetrics') {
      toolResult = calculateFinancialMetrics(args);
    } else if (toolName === 'searchIvanKnowledge') {
      toolResult = searchIvanKnowledge(args.query);
    } else if (toolName === 'getGeneralFinanceExplanation') {
      toolResult = getGeneralFinanceExplanation(args.topic || userQuery);
    }

    // Append Function Call and Function Response to contents
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

    // Turn 2: Send Tool Response back to Gemini
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

  const finalAnswer = modelPart?.text || '無法取得 AI 回應。';
  return {
    answer: finalAnswer,
    isRealGemini: true
  };
}
