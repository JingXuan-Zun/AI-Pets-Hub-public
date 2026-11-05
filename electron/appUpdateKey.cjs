// Checks that a hot-update version list was made by us (ed25519). Only the public half is here;
// the private key that signs lists stays on the publisher's computer, outside every repository
// (scripts/app-update-keygen.mjs). Changing this key makes installed copies reject updates
// signed with the old one, so it changes only with a full release.
const APP_UPDATE_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAU/h+KRlbsY0USC9fhr9JsQ/HhzP81fL/p0v9RFDpFwk=
-----END PUBLIC KEY-----
`;

// Where the list is read, in order: our Cloudflare service (fast in China), then GitHub.
const APP_UPDATE_SOURCES = [
  'https://ai-desktop-pet-plugin-api.qianxuanlian.workers.dev/updates/latest.json',
  'https://github.com/JingXuan-Zun/AI-Pets-Hub-public/releases/latest/download/latest.json',
];

module.exports = { APP_UPDATE_PUBLIC_KEY, APP_UPDATE_SOURCES };
