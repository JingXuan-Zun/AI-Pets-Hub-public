import assert from 'node:assert/strict';
import { collectMcpResultImages, findImagePaths, localFileUrl } from '../src/agent/mcpResultImages';

// Pictures an MCP tool hands back go to the chat: inline ones, and ones it saved and named.

assert.deepEqual(findImagePaths('Saved screenshot to C:\\Users\\ASUS\\AppData\\Local\\Temp\\chrome-devtools-mcp-x\\screenshot.png.'), ['C:\\Users\\ASUS\\AppData\\Local\\Temp\\chrome-devtools-mcp-x\\screenshot.png'], 'a Windows path in a sentence');
assert.deepEqual(findImagePaths('/tmp/a.jpg and /tmp/a.jpg and notes.txt'), ['/tmp/a.jpg'], 'each path once, only pictures');
assert.deepEqual(findImagePaths('no files here'), [], 'nothing named');
assert.equal(localFileUrl('C:\\Temp\\一 张.png'), 'desktop-pet-file://local/C%3A/Temp/%E4%B8%80%20%E5%BC%A0.png', 'local address, encoded');

const inline = await collectMcpResultImages([{ text: 'Took a screenshot.', type: 'text' }, { data: 'iVBOR', mimeType: 'image/png', text: '', type: 'image' }], 'chrome-devtools-take_screenshot');
assert.deepEqual(inline, [{ dataUrl: 'data:image/png;base64,iVBOR', mimeType: 'image/png', name: 'chrome-devtools-take_screenshot-1.png' }], 'inline pictures as data URLs');
// Outside the app the file cannot be read: nothing is shown, nothing breaks.
assert.deepEqual(await collectMcpResultImages([{ text: 'Saved to C:\\nope\\x.png', type: 'text' }], 'x'), [], 'unreadable files are skipped');

console.log('mcp result images smoke ok: 6 checks');
