/**
 * Cloudflare Worker — DeepSeek API Proxy
 * Deploy via:  npx wrangler deploy
 *
 * Frontend sends:  POST /  { model, messages, temperature, max_tokens }
 *                  Header:  X-Auth-Token
 * Worker forwards to DeepSeek with the secret API key.
 */

export default {
  async fetch(request, env) {
    // ── CORS Preflight ──
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders()
      });
    }

    // ── Only accept POST ──
    if (request.method !== 'POST') {
      return json({ error: 'Method not allowed' }, 405);
    }

    // ── Simple auth check ──
    const auth = request.headers.get('X-Auth-Token');
    if (auth !== env.AUTH_TOKEN) {
      return json({ error: 'Unauthorized' }, 401);
    }

    // ── Parse body ──
    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'Invalid JSON' }, 400);
    }

    if (!body.messages || !Array.isArray(body.messages)) {
      return json({ error: 'Missing messages array' }, 400);
    }

    // ── Forward to DeepSeek ──
    const deepseekResp = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + env.DEEPSEEK_API_KEY
      },
      body: JSON.stringify({
        model: body.model || 'deepseek-v4-flash',
        messages: body.messages,
        temperature: body.temperature ?? 0.7,
        max_tokens: body.max_tokens ?? 1024,
        stream: false
      })
    });

    const data = await deepseekResp.json();

    return new Response(JSON.stringify(data), {
      status: deepseekResp.status,
      headers: corsHeaders()
    });
  }
};

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Auth-Token',
    'Content-Type': 'application/json'
  };
}

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: corsHeaders()
  });
}
