const RADIO_GROUP_SELECTOR = '#mf_txppWframe_rdoRecApeClCdTop';
const RADIO_CLAIM = '#mf_txppWframe_rdoRecApeClCdTop_input_0'; // 청구
const RADIO_RECEIPT = '#mf_txppWframe_rdoRecApeClCdTop_input_1'; // 영수

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
 * 청구/영수 라디오 상태 확인 후, 영수일 경우 청구로 변경
 * @param {import('puppeteer').Page} page
 */
async function ensureClaimSelected(page, target = '청구') {
  const found = await waitForSelectorInAnyFrame(page, RADIO_GROUP_SELECTOR, { timeout: 8000 });
  if (!found) {
    console.log('⚠️ 청구/영수 라디오 그룹을 찾지 못했습니다.');
    return;
  }
  const frame = found.frame;

  const targetIsClaim = (target || '').includes('청구');

  const status = await frame.evaluate(
    (claimSel, receiptSel) => {
      const claim = document.querySelector(claimSel);
      const receipt = document.querySelector(receiptSel);
      return {
        claimChecked: !!claim?.checked,
        receiptChecked: !!receipt?.checked,
      };
    },
    RADIO_CLAIM,
    RADIO_RECEIPT,
  );

  const desiredSelector = targetIsClaim ? RADIO_CLAIM : RADIO_RECEIPT;
  const desiredLabel = targetIsClaim ? '청구' : '영수';
  const alreadyOk = targetIsClaim ? status.claimChecked : status.receiptChecked;

  if (alreadyOk) {
    console.log(`ℹ️ 청구/영수 라디오: 이미 ${desiredLabel}로 설정됨`);
    return;
  }

  await frame.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return;
    ['mousedown', 'mouseup', 'click', 'change'].forEach((type) => {
      el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }));
    });
  }, desiredSelector);
  console.log(`✅ 청구/영수 라디오: ${desiredLabel}로 설정`);
}

module.exports = { ensureClaimSelected };

