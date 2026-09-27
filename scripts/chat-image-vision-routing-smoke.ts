import assert from 'node:assert/strict';
import { getPetResponse } from '../src/services/geminiService';
import type { ChatMessageImageAttachment, PetConfig, PetPersonality } from '../src/types';

const originalFetch = globalThis.fetch;

function createImageAttachment(
  id: string,
  name: string,
  base64: string,
): ChatMessageImageAttachment {
  return {
    dataUrl: `data:image/png;base64,${base64}`,
    height: 64,
    id,
    kind: 'image',
    mimeType: 'image/png',
    name,
    sizeBytes: base64.length,
    width: 64,
  };
}

const imageAttachments = [
  createImageAttachment('chat-image-dog', 'dog.png', 'ZG9n'),
  createImageAttachment('chat-image-cat', 'cat.png', 'Y2F0'),
];

const personality: PetPersonality = {
  beginDialogs: [],
  chatAvatarUrl: '',
  chatHistoryMemory: '',
  customErrorMessage: '',
  greeting: '',
  knowledgeBase: '',
  name: '测试桌宠',
  systemInstruction: '',
  traits: [],
  userMemory: '',
};

function createSettings(
  customModelCapabilities: PetConfig['settings']['customModelCapabilities'],
): PetConfig['settings'] {
  return {
    customApiKey: 'chat-key',
    customApiUrl: 'https://chat.example.com/v1',
    customModelCapabilities,
    customModelName: 'chat-model',
    customModelRequestParams: [],
    globalKnowledgeBase: '',
    llmModel: 'gemini-1.5-flash',
    llmProvider: 'openai',
    memoryDepth: 4096,
    timeAwarenessEnabled: false,
    visionCustomApiKey: 'vision-key',
    visionCustomApiUrl: 'https://vision.example.com/v1',
    visionCustomModelName: 'vision-model',
    visionCustomModelRequestParams: [],
    visionMode: 'dedicated-vision-model',
    visionModelProvider: 'openai',
    webLearningEnabled: false,
    webSearchEnabled: false,
    webSearchProvider: 'browser',
  } as PetConfig['settings'];
}

function assertVisionRequest(body: any, expectedIndex: number) {
  assert.equal(body.messages[1].role, 'user');
  assert.equal(body.messages[1].content[1].type, 'image_url');
  assert.equal(
    body.messages[1].content[1].image_url.url,
    imageAttachments[expectedIndex - 1]?.dataUrl,
  );
  assert.match(body.messages[1].content[0].text, new RegExp(`chat image ${expectedIndex}`));
}

async function runTextOnlyChatModelScenario() {
  const fetchCalls: Array<{ body: any; url: string }> = [];

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) : null;
    fetchCalls.push({ body, url });

    if (url.includes('vision.example.com')) {
      const visionCallCount = fetchCalls.filter((call) => call.url.includes('vision.example.com')).length;
      assertVisionRequest(body, visionCallCount);
      return new Response(JSON.stringify({
        choices: [
          {
            message: {
              content: visionCallCount === 1
                ? '图片里是一只鼻子离镜头很近的狗�?
                : '图片里是一只坐在窗边的猫�?,
            },
          },
        ],
      }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    assert.equal(url, 'https://chat.example.com/v1/chat/completions');
    const finalUserMessage = body.messages[body.messages.length - 1];
    assert.equal(finalUserMessage.role, 'user');
    assert.equal(typeof finalUserMessage.content, 'string');
    assert.match(finalUserMessage.content, /图片 1（dog\.png）：\n图片里是一只鼻子离镜头很近的狗�?u);
    assert.match(finalUserMessage.content, /图片 2（cat\.png）：\n图片里是一只坐在窗边的猫�?u);
    assert.doesNotMatch(JSON.stringify(body), /image_url/u);

    return new Response(JSON.stringify({
      choices: [
        {
          message: {
            content: '看见了，第一张是狗，第二张是猫�?,
          },
        },
      ],
    }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    });
  }) as typeof fetch;

  const response = await getPetResponse(
    [],
    '能看见这两张图嘛',
    personality,
    createSettings({
      image: false,
      reasoning: false,
      text: true,
      tools: false,
    }),
    'allow',
    imageAttachments,
  );

  assert.equal(response, '看见了，第一张是狗，第二张是猫�?);
  assert.equal(fetchCalls.length, 3);
  assert.equal(fetchCalls[0]?.url, 'https://vision.example.com/v1/chat/completions');
  assert.equal(fetchCalls[1]?.url, 'https://vision.example.com/v1/chat/completions');
  assert.equal(fetchCalls[2]?.url, 'https://chat.example.com/v1/chat/completions');
}

async function runImageCapableChatModelScenario() {
  const fetchCalls: Array<{ body: any; url: string }> = [];

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) : null;
    fetchCalls.push({ body, url });

    if (url.includes('vision.example.com')) {
      const visionCallCount = fetchCalls.filter((call) => call.url.includes('vision.example.com')).length;
      assertVisionRequest(body, visionCallCount);
      return new Response(JSON.stringify({
        choices: [
          {
            message: {
              content: visionCallCount === 1
                ? '图片里是一只狗�?
                : '图片里是一只猫�?,
            },
          },
        ],
      }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    assert.equal(url, 'https://chat.example.com/v1/chat/completions');
    const finalUserMessage = body.messages[body.messages.length - 1];
    assert.equal(finalUserMessage.role, 'user');
    assert.ok(Array.isArray(finalUserMessage.content));

    const imageParts = finalUserMessage.content.filter((part: any) => part?.type === 'image_url');
    assert.equal(imageParts.length, 2);
    assert.equal(imageParts[0]?.image_url?.url, imageAttachments[0]?.dataUrl);
    assert.equal(imageParts[1]?.image_url?.url, imageAttachments[1]?.dataUrl);
    assert.match(finalUserMessage.content[0]?.text, /图片 1（dog\.png）：\n图片里是一只狗�?u);
    assert.match(finalUserMessage.content[0]?.text, /图片 2（cat\.png）：\n图片里是一只猫�?u);

    return new Response(JSON.stringify({
      choices: [
        {
          message: {
            content: '两张原图都收到了�?,
          },
        },
      ],
    }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    });
  }) as typeof fetch;

  const response = await getPetResponse(
    [],
    '分别看看这两张图',
    personality,
    createSettings({
      image: true,
      reasoning: false,
      text: true,
      tools: false,
    }),
    'allow',
    imageAttachments,
  );

  assert.equal(response, '两张原图都收到了�?);
  assert.equal(fetchCalls.length, 3);
  assert.equal(fetchCalls[0]?.url, 'https://vision.example.com/v1/chat/completions');
  assert.equal(fetchCalls[1]?.url, 'https://vision.example.com/v1/chat/completions');
  assert.equal(fetchCalls[2]?.url, 'https://chat.example.com/v1/chat/completions');
}

try {
  await runTextOnlyChatModelScenario();
  await runImageCapableChatModelScenario();
} finally {
  globalThis.fetch = originalFetch;
}

console.log('chat image vision routing smoke ok');
