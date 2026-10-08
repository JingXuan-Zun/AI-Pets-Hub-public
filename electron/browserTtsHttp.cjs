const http = require('http');

const HEALTH_TIMEOUT_MS = 3000;

function requestJson(url, options = {}) {
  return new Promise((resolve, reject) => {
    const request = http.request(
      url,
      {
        method: options.method || 'GET',
        timeout: options.timeoutMs || HEALTH_TIMEOUT_MS,
        headers: options.headers || {},
      },
      (response) => {
        let body = '';
        response.setEncoding('utf8');
        response.on('data', (chunk) => {
          body += chunk;
        });
        response.on('end', () => {
          let parsed = null;
          try {
            parsed = body ? JSON.parse(body) : null;
          } catch {
            parsed = { raw: body };
          }
          resolve({
            ok: response.statusCode >= 200 && response.statusCode < 300,
            statusCode: response.statusCode,
            body: parsed,
          });
        });
      },
    );

    request.on('timeout', () => {
      request.destroy(new Error('browser_tts_health_timeout'));
    });
    request.on('error', reject);
    request.end();
  });
}

module.exports = { HEALTH_TIMEOUT_MS, requestJson };
