const PAGE_LOAD_WAIT_MS = 4500;

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

module.exports = { delay, PAGE_LOAD_WAIT_MS };
