/**
 * Secure Backend Proxy & Public Asset Server for Leveraged Life Assistant
 * Security Hardened: Allowlist, Path Traversal Protection, Payload Size Limit, CORS Restriction
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { processQueryWithContext } from './js/assistant.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env file if present
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      const key = match[1];
      let value = match[2] || '';
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
      process.env[key] = value;
    }
  });
}

const PORT = process.env.PORT || 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const IS_LLM_MODE = Boolean(GEMINI_API_KEY && GEMINI_API_KEY !== 'your_gemini_api_key_here');

if (IS_LLM_MODE) {
  console.log('✅ [SERVER] GEMINI_API_KEY detected. Active Gemini REST API proxy enabled.');
} else {
  console.log('⚡ [SERVER] GEMINI_API_KEY is not set. Operating in Offline Rules Mode. (Set GEMINI_API_KEY in .env to enable Gemini LLM API)');
}

// In-Memory Session Storage
const sessions = new Map();

// Allowed Origins for CORS Security
const ALLOWED_ORIGINS = new Set([
  `http://localhost:${PORT}`,
  `http://127.0.0.1:${PORT}`,
  `http://localhost:3000`,
  `http://127.0.0.1:3000`
]);

// Public Allowlist for Static Assets
const PUBLIC_ALLOWLIST_PATTERNS = [
  /^\/$/,
  /^\/index\.html$/,
  /^\/slides\.html$/,
  /^\/js\/[a-zA-Z0-9_-]+\.js$/,
  /^\/css\/[a-zA-Z0-9_-]+\.css$/,
  /^\/favicon\.ico$/
];

// Explicit Deny Patterns
const DENY_PATTERNS = [
  /\.env.*/i,
  /\.git.*/i,
  /server\.js$/i,
  /\/test\//i,
  /package.*\.json$/i,
  /my_portfolio\.json$/i,
  /\/\./ // Any hidden directory or file starting with dot
];

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.ico': 'image/x-icon'
};

const MAX_PAYLOAD_BYTES = 1024 * 1024; // 1 MB payload limit

function isOriginAllowed(origin) {
  if (!origin) return true; // Same origin request
  return ALLOWED_ORIGINS.has(origin);
}

const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin;

  // CORS Verification
  if (origin && !isOriginAllowed(origin)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('403 Forbidden: CORS Origin Not Allowed');
    return;
  }

  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // API Endpoint: GET /api/status
  if (req.url === '/api/status' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      mode: IS_LLM_MODE ? 'llm' : 'offline_rules',
      modeText: IS_LLM_MODE ? '🤖 LLM 在線模式' : '⚡ 離線規則模式'
    }));
    return;
  }

  // API Endpoint: POST /api/chat
  if (req.url === '/api/chat' && req.method === 'POST') {
    let body = '';
    let bodyLength = 0;
    let payloadTooLarge = false;

    req.on('data', chunk => {
      bodyLength += chunk.length;
      if (bodyLength > MAX_PAYLOAD_BYTES) {
        payloadTooLarge = true;
        req.destroy();
      } else {
        body += chunk.toString();
      }
    });

    req.on('end', async () => {
      if (payloadTooLarge) {
        res.writeHead(413, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: '413 Payload Too Large (Max 1MB)' }));
        return;
      }

      try {
        const payload = JSON.parse(body || '{}');
        const message = payload.message || '';
        const sessionId = payload.sessionId || 'default';

        // Retrieve or initialize session state
        if (!sessions.has(sessionId)) {
          sessions.set(sessionId, {
            income: null,
            unsecuredDebt: null,
            pledgedValue: null,
            loanBalance: null,
            totalAssets: null,
            leveragedETFValue: null,
            targetRate: 130,
            history: []
          });
        }
        const session = sessions.get(sessionId);

        // Process message with Engine
        const result = await processQueryWithContext(
          message,
          session.history,
          session,
          IS_LLM_MODE ? GEMINI_API_KEY : null
        );

        // Update session history
        session.history.push({ role: 'user', text: message });
        session.history.push({ role: 'assistant', text: result.answer });

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({
          mode: IS_LLM_MODE ? 'llm' : 'offline_rules',
          modeText: IS_LLM_MODE ? '🤖 LLM 在線模式' : '⚡ 離線規則模式',
          intent: result.intent,
          answer: result.answer,
          sessionState: result.sessionState || session
        }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // Static File Serving with Security Protection
  const requestPath = req.url.split('?')[0];

  // 1. Explicit Deny Check
  if (DENY_PATTERNS.some(pattern => pattern.test(requestPath))) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('403 Access Denied: Sensitive File / Protected Resource');
    return;
  }

  // 2. Allowlist Check
  const isAllowed = PUBLIC_ALLOWLIST_PATTERNS.some(pattern => pattern.test(requestPath));
  if (!isAllowed) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('403 Access Denied: Resource Not In Public Allowlist');
    return;
  }

  // 3. Path Traversal Defense
  const safeRelativePath = requestPath === '/' ? 'index.html' : requestPath.substring(1);
  const resolvedPath = path.resolve(__dirname, safeRelativePath);

  if (!resolvedPath.startsWith(__dirname)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('403 Access Denied: Directory Traversal Blocked');
    return;
  }

  fs.stat(resolvedPath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(resolvedPath);
    const mime = MIME_TYPES[ext] || 'text/plain';
    res.writeHead(200, { 'Content-Type': mime });
    fs.createReadStream(resolvedPath).pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`🚀 [SERVER] Leveraged Life Assistant server running on http://localhost:${PORT}`);
});
