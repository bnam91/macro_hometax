const DATE_INPUT_SELECTOR = '#mf_txppWframe_calWrtDtTop_input';

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

/**
 * 작성일자 설정 (yyyyMMdd 형태의 숫자 문자열)
 * @param {import('puppeteer').Page} page
 * @param {string} dateString 예: '20251228'
 */
async function setWriteDate(page, dateString = '20251228') {
  const found = await waitForSelectorInAnyFrame(page, DATE_INPUT_SELECTOR, { timeout: 8000 });
  if (!found) {
    console.log('⚠️ 작성일자 입력 필드를 찾지 못했습니다.');
    return;
  }
  const { frame, handle: input } = found;

  // 포맷 변환: yyyyMMdd -> yyyy-MM-dd 입력 시도
  const digits = (dateString || '').replace(/\D/g, '');
  const dashed =
    digits.length === 8 ? `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}` : dateString;

  await input.click({ clickCount: 3 });
  await input.type(dashed, { delay: 50 });

  // change/blur 이벤트 발생
  await frame.evaluate((selector) => {
    const el = document.querySelector(selector);
    if (!el) return;
    ['input', 'change', 'blur'].forEach((type) => {
      el.dispatchEvent(new Event(type, { bubbles: true }));
    });
  }, DATE_INPUT_SELECTOR);

  console.log(`✅ 작성일자 입력 완료: ${dashed}`);
}

module.exports = { setWriteDate };

