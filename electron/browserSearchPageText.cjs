const { createDevToolsClient } = require('./browserSearchDevToolsClient.cjs');

const MAX_RESULT_TEXT_LENGTH = 6000;

function normalizeExtractedText(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_RESULT_TEXT_LENGTH);
}

function extractTextFromDocumentLike(documentLike) {
  const ignoredSelectors = 'script,style,noscript,svg,canvas,iframe,[aria-hidden="true"]';
  const title = typeof documentLike?.title === 'string' && documentLike.title.trim()
    ? `Title: ${documentLike.title.trim()}`
    : '';
  const body = documentLike?.body?.cloneNode ? documentLike.body.cloneNode(true) : null;

  if (body && typeof body.querySelectorAll === 'function') {
    Array.from(body.querySelectorAll(ignoredSelectors)).forEach((node) => {
      if (node && typeof node.remove === 'function') {
        node.remove();
      }
    });
  }

  const text = body && typeof body.innerText === 'string'
    ? body.innerText
    : '';

  return [title, text].filter(Boolean).join('\n');
}

async function extractPageText(webSocketDebuggerUrl) {
  const client = await createDevToolsClient(webSocketDebuggerUrl);

  try {
    await client.send('Runtime.enable');
    const result = await client.send('Runtime.evaluate', {
      awaitPromise: true,
      expression: `(${extractTextFromDocumentLike.toString()})(document)`,
      returnByValue: true,
    });

    return normalizeExtractedText(result?.result?.value ?? '');
  } finally {
    client.close();
  }
}

module.exports = { normalizeExtractedText, extractTextFromDocumentLike, extractPageText };
