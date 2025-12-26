const ISSUE_BUTTON_SELECTOR = '#mf_txppWframe_btnIsn';
const CONFIRM_POPUP_BUTTON_SELECTOR = '#mf_txppWframe_UTEETZZA89_wframe_trigger20'; // 확인(인증 화면 이동)

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

async function clickIssueButton(page) {
  const found = await waitForSelectorInAnyFrame(page, ISSUE_BUTTON_SELECTOR, { timeout: 8000 });
  if (!found) {
    console.log('⚠️ 발급하기 버튼을 찾지 못했습니다.');
    return;
  }
  const { frame } = found;

  await frame.evaluate((sel) => {
    const btn = document.querySelector(sel);
    if (!btn) return;
    btn.scrollIntoView({ block: 'center', behavior: 'instant' });
    ['mousedown', 'mouseup', 'click'].forEach((type) => {
      btn.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }));
    });
  }, ISSUE_BUTTON_SELECTOR);

  console.log('✅ 발급하기 버튼 클릭 완료');
}

/**
 * 사용자가 레이어 팝업의 "확인(인증 화면 이동)" 버튼을 클릭했는지 감지
 * 자동 클릭 없이 사용자 입력을 기다립니다.
 * @param {import('puppeteer').Page} page
 * @param {number} timeoutMs
 */
async function waitForUserConfirmClick(page, timeoutMs = 300000) {
  // 팝업이 사라지는 것도 사용자 클릭으로 간주
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const found = await waitForSelectorInAnyFrame(page, CONFIRM_POPUP_BUTTON_SELECTOR, { timeout: 2000 }).catch(() => null);
    if (!found) {
      console.log('ℹ️ 확인 팝업이 닫힌 것으로 감지했습니다.');
      return;
    }
    const { frame } = found;

    // 클릭 여부 플래그 설정
    const attached = await frame.evaluate((sel) => {
      const btn = document.querySelector(sel);
      if (!btn) return false;
      if (btn.__userClickListenerAttached) return true;
      btn.__userClickListenerAttached = true;
      btn.addEventListener('click', () => {
        btn.dataset.userClicked = '1';
      });
      return true;
    }, CONFIRM_POPUP_BUTTON_SELECTOR);

    if (!attached) {
      console.log('⚠️ 확인 버튼에 리스너를 붙이지 못했습니다.');
      return;
    }

    const clicked = await frame
      .waitForFunction(
        (sel) => {
          const btn = document.querySelector(sel);
          return btn && btn.dataset.userClicked === '1';
        },
        { polling: 300, timeout: 3000 },
        CONFIRM_POPUP_BUTTON_SELECTOR,
      )
      .then(() => true)
      .catch(() => false);

    if (clicked) {
      console.log('✅ 확인(인증 화면 이동) 버튼을 사용자 클릭으로 감지했습니다.');
      return;
    }

    // 루프 계속: 버튼은 있지만 클릭 감지 못함 → 재시도
  }

  console.log('⚠️ 확인 버튼 사용자 클릭을 지정한 시간 안에 감지하지 못했습니다.');
}

module.exports = { clickIssueButton, waitForUserConfirmClick };

