const http = require('http');

const DEVTOOLS_CONNECT_TIMEOUT_MS = 8000;

function requestJson(url, timeoutMs = DEVTOOLS_CONNECT_TIMEOUT_MS, method = 'GET') {
  return new Promise((resolve, reject) => {
    const request = http.request(url, { method, timeout: timeoutMs }, (response) => {
      let body = '';

      response.setEncoding('utf8');
      response.on('data', (chunk) => {
        body += chunk;
      });
      response.on('end', () => {
        if (!response.statusCode || response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error(`DevTools request failed (${response.statusCode || 'unknown'})`));
          return;
        }

        try {
          resolve(JSON.parse(body));
        } catch (error) {
          reject(error);
        }
      });
    });

    request.on('timeout', () => {
      request.destroy(new Error('DevTools request timed out'));
    });
    request.on('error', reject);
    request.end();
  });
}

function requestText(url, timeoutMs = DEVTOOLS_CONNECT_TIMEOUT_MS, method = 'GET') {
  return new Promise((resolve, reject) => {
    const request = http.request(url, { method, timeout: timeoutMs }, (response) => {
      let body = '';

      response.setEncoding('utf8');
      response.on('data', (chunk) => {
        body += chunk;
      });
      response.on('end', () => {
        if (!response.statusCode || response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error(`DevTools request failed (${response.statusCode || 'unknown'})`));
          return;
        }

        resolve(body);
      });
    });

    request.on('timeout', () => {
      request.destroy(new Error('DevTools request timed out'));
    });
    request.on('error', reject);
    request.end();
  });
}

module.exports = { requestJson, requestText, DEVTOOLS_CONNECT_TIMEOUT_MS };
