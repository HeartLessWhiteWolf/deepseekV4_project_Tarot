'use strict';

/* ========================================
   DeepSeek API Client Module
   Dependencies: none
   Calls a Cloudflare Worker proxy that holds the
   secret API key — the key never touches the browser.
   ======================================== */
var DeepSeekAPI = (function() {
  'use strict';

  var CONFIG = {
    model: 'deepseek-v4-flash',
    proxyUrl: 'https://tarot-proxy.634154315.workers.dev',
    authToken: 'dev-only-change-in-production',
    timeout: 30000,
    maxRetries: 2,
    cacheEnabled: true
  };

  var cache = {};
  var cacheMaxSize = 50;

  /* ========================================
     Logging
     ======================================== */
  function log(level, message, data) {
    var timestamp = new Date().toISOString();
    var prefix = '[DeepSeekAPI ' + timestamp + '] [' + level + ']';
    if (data !== undefined) {
      console.log(prefix + ' ' + message, data);
    } else {
      console.log(prefix + ' ' + message);
    }
  }

  /* ========================================
     Cache Management
     ======================================== */
  function getCacheKey(prompt) {
    var hash = 0;
    for (var i = 0; i < prompt.length; i++) {
      var char = prompt.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    return 'cache_' + hash;
  }

  function getCached(prompt) {
    if (!CONFIG.cacheEnabled) return null;
    var key = getCacheKey(prompt);
    if (cache[key]) {
      log('CACHE', 'HIT for prompt hash: ' + key);
      return cache[key];
    }
    return null;
  }

  function setCache(prompt, value) {
    if (!CONFIG.cacheEnabled) return;
    var keys = Object.keys(cache);
    if (keys.length >= cacheMaxSize) {
      delete cache[keys[0]];
    }
    var key = getCacheKey(prompt);
    cache[key] = value;
    log('CACHE', 'STORED for prompt hash: ' + key);
  }

  function clearCache() {
    cache = {};
    log('CACHE', 'Cleared all cache entries');
  }

  /* ========================================
     API Call Core
     ======================================== */
  function callAPI(messages, options) {
    options = options || {};
    var retries = options.retries || 0;

    return new Promise(function(resolve, reject) {
      var startTime = Date.now();

      var body = {
        model: CONFIG.model,
        messages: messages,
        temperature: 0.7,
        max_tokens: 1024,
        stream: false
      };

      log('REQUEST', 'Calling DeepSeek API', {
        model: CONFIG.model,
        messageCount: messages.length,
        totalChars: messages.reduce(function(s, m) { return s + m.content.length; }, 0)
      });

      var xhr = new XMLHttpRequest();
      xhr.open('POST', CONFIG.proxyUrl, true);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.setRequestHeader('X-Auth-Token', CONFIG.authToken);
      xhr.timeout = CONFIG.timeout;

      xhr.onload = function() {
        var elapsed = Date.now() - startTime;

        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            var response = JSON.parse(xhr.responseText);
            log('RESPONSE', 'API call succeeded in ' + elapsed + 'ms', {
              status: xhr.status,
              usage: response.usage || 'N/A'
            });
            resolve(response);
          } catch (e) {
            log('ERROR', 'Failed to parse API response: ' + e.message, xhr.responseText.substring(0, 200));
            reject(new Error('Response parse error: ' + e.message));
          }
        } else if (xhr.status === 429 && retries < CONFIG.maxRetries) {
          log('RETRY', 'Rate limited (429), retrying in ' + ((retries + 1) * 2000) + 'ms (attempt ' + (retries + 1) + ')');
          setTimeout(function() {
            callAPI(messages, { retries: retries + 1 }).then(resolve).catch(reject);
          }, (retries + 1) * 2000);
        } else if (xhr.status >= 500 && retries < CONFIG.maxRetries) {
          log('RETRY', 'Server error ' + xhr.status + ', retrying in ' + ((retries + 1) * 1000) + 'ms (attempt ' + (retries + 1) + ')');
          setTimeout(function() {
            callAPI(messages, { retries: retries + 1 }).then(resolve).catch(reject);
          }, (retries + 1) * 1000);
        } else {
          var errMsg = 'API error ' + xhr.status + ': ' + xhr.responseText.substring(0, 300);
          log('ERROR', 'API call failed after ' + elapsed + 'ms: ' + errMsg);
          reject(new Error(errMsg));
        }
      };

      xhr.onerror = function() {
        log('ERROR', 'Network error - XHR onerror fired');
        reject(new Error('Network connection failed'));
      };

      xhr.ontimeout = function() {
        log('ERROR', 'Request timed out after ' + CONFIG.timeout + 'ms');
        reject(new Error('Request timed out'));
      };

      xhr.send(JSON.stringify(body));
    });
  }

  /* ========================================
     Extract AI Content from Response
     ======================================== */
  function extractContent(response) {
    if (response && response.choices && response.choices.length > 0) {
      return (response.choices[0].message || {}).content || '';
    }
    return '';
  }

  /* ========================================
     Content Filtering
     ======================================== */
  function sanitizeContent(text) {
    if (!text) return '';
    text = text.trim();
    if (text.length > 2000) {
      text = text.substring(0, 2000);
      text = text.substring(0, Math.max(text.lastIndexOf('。'), text.lastIndexOf('\n'))) + '。';
    }
    return text;
  }

  /* ========================================
     Prompt Templates
     ======================================== */
  function buildThemePrompt(cardName, cardSymbol, positionName, userTheme) {
    return '你是一位资深塔罗占卜师。请根据以下信息，以古朴典雅、充满神秘感的语调，生成一段约80-120字的塔罗牌解读文字：\n\n' +
      '【卡牌】' + cardName + '（' + cardSymbol + '）\n' +
      '【位置】' + positionName + '\n' +
      '【用户主题】' + userTheme + '\n\n' +
      '请结合用户的具体主题，分析这张牌在' + positionName + '位置出现时，对该主题的深层启示。语言需优美、富有哲理，使用敬语"您"。直接给出解读正文，不要加任何前缀标记或问候语。';
  }

  function buildOverallPrompt(cards, userTheme) {
    var cardDescriptions = cards.map(function(c, i) {
      var positions = ['过去', '现在', '未来'];
      return positions[i] + '：' + c.card.symbol + ' ' + c.card.nameZh;
    }).join('\n');

    return '你是一位资深塔罗占卜师。请根据以下三牌占卜结果，以古朴典雅、充满神秘感的语调，生成一段约200-300字的综合解读：\n\n' +
      '【用户主题】' + userTheme + '\n' +
      '【三牌结果】\n' + cardDescriptions + '\n\n' +
      '请综合分析过去、现在、未来三张牌的关联，解读它们对用户主题的整体启示。语言需优美流畅、富有哲理，使用敬语"您"。以"亲爱的求问者"开头，直接给出完整解读，不要加任何前缀标记。';
  }

  /* ========================================
     Public API Methods
     ======================================== */
  function generateThemeInterpretation(cardName, cardSymbol, positionName, userTheme) {
    var prompt = buildThemePrompt(cardName, cardSymbol, positionName, userTheme);

    var cached = getCached(prompt);
    if (cached) {
      return Promise.resolve(cached);
    }

    var messages = [
      { role: 'system', content: '你是一位经验丰富的塔罗占卜师，说话风格古朴、典雅、充满智慧。' },
      { role: 'user', content: prompt }
    ];

    return callAPI(messages).then(function(response) {
      var content = sanitizeContent(extractContent(response));
      if (content) {
        setCache(prompt, content);
        return content;
      }
      throw new Error('Empty response from API');
    });
  }

  function generateOverallReading(cards, userTheme) {
    var prompt = buildOverallPrompt(cards, userTheme);

    var cached = getCached(prompt);
    if (cached) {
      return Promise.resolve(cached);
    }

    var messages = [
      { role: 'system', content: '你是一位经验丰富的塔罗占卜师，说话风格古朴、典雅、充满智慧。' },
      { role: 'user', content: prompt }
    ];

    return callAPI(messages).then(function(response) {
      var content = sanitizeContent(extractContent(response));
      if (content) {
        setCache(prompt, content);
        return content;
      }
      throw new Error('Empty response from API');
    });
  }

  /* ========================================
     Module Exports
     ======================================== */
  return {
    generateThemeInterpretation: generateThemeInterpretation,
    generateOverallReading: generateOverallReading,
    clearCache: clearCache
  };
})();
