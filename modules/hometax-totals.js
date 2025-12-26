const TOTAL_SELECTOR = '#mf_txppWframe_edtTotaAmtTop';
const SUPPLY_SELECTOR = '#mf_txppWframe_edtSumSplCftTop';
const TAX_SELECTOR = '#mf_txppWframe_edtSumTxamtTop';

function isContextDestroyed(err) {
  const msg = String(err || '');
  return (
    msg.includes('Execution context was destroyed') ||
    msg.includes('Most likely because of a navigation') ||
    msg.includes('Target closed') ||
    msg.includes('Cannot find context with specified id')
  );
}

async function waitForSelectorInAnyFrame(page, selector, options = {}) {
  const start = Date.now();
  const timeout = options.timeout ?? 8000;

  while (Date.now() - start < timeout) {
    for (const frame of page.frames()) {
      try {
        const handle = await frame.$(selector);
        if (handle) return { frame, handle };
      } catch (err) {
        if (!isContextDestroyed(err)) throw err;
      }
    }
    await page.waitForTimeout(200);
  }
  return null;
}

async function readText(frame, selector) {
  try {
    const txt = await frame.$eval(selector, (el) => (el.textContent || '').trim());
    return txt || '-';
  } catch {
    return '-';
  }
}

/**
 * 합계/공급가액/세액 값을 로그로 출력
 * @param {import('puppeteer').Page} page
 */
async function logTotals(page) {
  const found = await waitForSelectorInAnyFrame(page, TOTAL_SELECTOR, { timeout: 8000 });
  if (!found) {
    console.log('⚠️ 합계/공급가액/세액 영역을 찾지 못했습니다.');
    return;
  }
  const frame = found.frame;
  const total = await readText(frame, TOTAL_SELECTOR);
  const supply = await readText(frame, SUPPLY_SELECTOR);
  const tax = await readText(frame, TAX_SELECTOR);

  console.log('ℹ️ 합계/공급가액/세액:');
  console.log(`  합계금액: ${total}`);
  console.log(`  공급가액: ${supply}`);
  console.log(`  세액: ${tax}`);
}

module.exports = { logTotals };

