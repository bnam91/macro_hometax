const ROW_PREFIX = '#mf_txppWframe_genEtxivLsatTop_0_';

const DAY_SELECTOR = `${ROW_PREFIX}edtLsatSplDdTop`;
const ITEM_SELECTOR = `${ROW_PREFIX}edtLsatNmTop`;
const QTY_SELECTOR = `${ROW_PREFIX}edtLsatQtyTop`;
const PRICE_SELECTOR = `${ROW_PREFIX}edtLsatUtprcTop`;
const SUPPLY_SELECTOR = `${ROW_PREFIX}edtLsatSplCftTop`;
const TAX_SELECTOR = `${ROW_PREFIX}edtLsatTxamtTop`;
const REMARK_SELECTOR = `${ROW_PREFIX}edtLsatRmrkCntnTop`;

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

async function fillField(frame, selector, value) {
  try {
    const handle = await frame.$(selector);
    if (!handle) return;
    await handle.click({ clickCount: 3 });
    await handle.type(value, { delay: 30 });
    await frame.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) return;
      ['input', 'change', 'blur', 'keyup'].forEach((type) => {
        el.dispatchEvent(new Event(type, { bubbles: true }));
      });
    }, selector);
  } catch (err) {
    console.log(`⚠️ 필드 입력 실패 (${selector}): ${err.message}`);
  }
}

/**
 * 1행(첫 행)에 품목 데이터 입력
 * @param {import('puppeteer').Page} page
 * @param {object} param0
 * @param {string} param0.day 두 자리 일자
 * @param {string} param0.item 품목명
 * @param {string|number} param0.qty 수량
 * @param {string|number} param0.price 단가
 * @param {string|number} param0.supply 공급가액
 * @param {string|number} param0.tax 세액
 * @param {string} param0.remark 비고
 */
async function fillFirstItemRow(
  page,
  { day = '15', item = '연습', qty = '1', price = '10000' } = {},
) {
  const found = await waitForSelectorInAnyFrame(page, DAY_SELECTOR, { timeout: 8000 });
  if (!found) {
    console.log('⚠️ 품목 행을 찾지 못했습니다.');
    return;
  }
  const { frame } = found;

  await fillField(frame, DAY_SELECTOR, String(day));
  await fillField(frame, ITEM_SELECTOR, String(item));
  await fillField(frame, QTY_SELECTOR, String(qty));
  await fillField(frame, PRICE_SELECTOR, String(price));

  console.log(
    `✅ 품목 입력 완료: 일=${day}, 품목=${item}, 수량=${qty}, 단가=${price} (공급가액/세액/비고는 화면 자동값)`,
  );
}

async function logFirstItemRowValues(page) {
  const found = await waitForSelectorInAnyFrame(page, DAY_SELECTOR, { timeout: 8000 });
  if (!found) {
    console.log('⚠️ 품목 행을 찾지 못해 검증을 건너뜁니다.');
    return;
  }
  const { frame } = found;

  const read = async (sel) =>
    frame
      .$eval(sel, (el) => {
        if (!el) return '';
        return (el.value ?? el.textContent ?? '').trim();
      })
      .catch(() => '');

  const day = (await read(DAY_SELECTOR)) || '-';
  const item = (await read(ITEM_SELECTOR)) || '-';
  const qty = (await read(QTY_SELECTOR)) || '-';
  const price = (await read(PRICE_SELECTOR)) || '-';
  const supply = (await read(SUPPLY_SELECTOR)) || '-';
  const tax = (await read(TAX_SELECTOR)) || '-';
  const remark = (await read(REMARK_SELECTOR)) || '-';

  console.log('ℹ️ 품목 입력값 확인:');
  console.log(`  일=${day}, 품목=${item}, 수량=${qty}, 단가=${price}, 공급가액=${supply}, 세액=${tax}, 비고=${remark}`);
}

module.exports = { fillFirstItemRow, logFirstItemRowValues };

