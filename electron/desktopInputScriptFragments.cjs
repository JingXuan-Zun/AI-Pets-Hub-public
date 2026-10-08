// Capture substitutions without converting them before later phases read their inputs.
function captureScriptFragment(template, ...values) {
  return { raw: template.raw, values };
}

// The caller captures the renderer first; all phases share one final conversion pass.
function renderScriptFragments(renderer, ...fragments) {
  const raw = [''];
  const values = [];
  for (const fragment of fragments) {
    raw[raw.length - 1] += fragment.raw[0];
    for (let index = 1; index < fragment.raw.length; index += 1) {
      raw.push(fragment.raw[index]);
      values.push(fragment.values[index - 1]);
    }
  }
  return Reflect.apply(renderer, String, [{ raw }, ...values]);
}

module.exports = { captureScriptFragment, renderScriptFragments };
