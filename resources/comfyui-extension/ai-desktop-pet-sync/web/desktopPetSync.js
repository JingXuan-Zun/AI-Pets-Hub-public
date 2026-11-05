import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

// Every few seconds, if the canvas changed, store it as ComfyUI would queue it ("API format")
// under user/default/desktop-pet-sync/: once by the open workflow's name, once as _current.
// The desktop pet picks the copy that matches the workflow it was given.

const FOLDER = "desktop-pet-sync";
const INTERVAL_MS = 3000;
let last = "";

function activeName() {
  const workflow = app.extensionManager?.workflow?.activeWorkflow ?? app.workflowManager?.activeWorkflow;
  const name = workflow?.filename ?? workflow?.name ?? "";
  return String(name).replace(/\.json$/i, "").replace(/[\\/:*?"<>|]/g, "_").trim();
}

async function store(file, body) {
  await api.fetchApi(`/userdata/${encodeURIComponent(`${FOLDER}/${file}`)}?overwrite=true`, {
    body,
    method: "POST",
  });
}

async function sync() {
  try {
    const { output } = await app.graphToPrompt();
    const name = activeName();
    const text = JSON.stringify(output);
    if (`${name}\n${text}` === last) return;
    last = `${name}\n${text}`;
    const body = JSON.stringify({ name, prompt: output, savedAt: Date.now() });
    if (name) await store(`${name}.json`, body);
    await store("_current.json", body);
  } catch (error) {
    console.warn("[ai-desktop-pet-sync]", error);
  }
}

app.registerExtension({
  name: "ai-desktop-pet.sync",
  setup() {
    setInterval(sync, INTERVAL_MS);
  },
});
