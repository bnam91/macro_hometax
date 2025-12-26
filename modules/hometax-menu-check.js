const MENU_SELECTOR = '#mf_wfHeader_wq_uuid_369';
const SINGLE_ISSUE_ANCHOR = '#combineMenuAtag_4601010100';
const SINGLE_ISSUE_SPAN_TEXT = '전자(세금)계산서 건별발급';

/**
 * 최종 메뉴(계산서·영수증·카드)가 나타나는지 확인
 * @param {import('puppeteer').Page} page
 * @param {number} timeoutMs
 */
async function waitForMainMenu(page, timeoutMs = 60000) {
  await page.waitForSelector(MENU_SELECTOR, { visible: true, timeout: timeoutMs });
  console.log('✅ 최종 로그인 성공: 계산서·영수증·카드 메뉴가 보입니다.');
}

/**
 * 상단 메뉴 클릭 후 전자(세금)계산서 건별발급 진입
 * @param {import('puppeteer').Page} page
 */
async function openSingleIssue(page) {
  // 상단 메뉴 클릭
  const menuBtn = await page.$(MENU_SELECTOR);
  if (menuBtn) {
    await menuBtn.click();
    console.log('ℹ️ 상단 메뉴 클릭 완료');
  } else {
    console.log('⚠️ 상단 메뉴 버튼을 찾지 못했습니다.');
    return;
  }

  // 건별발급 링크 클릭 (우선 ID, 실패 시 텍스트 매칭)
  const anchor = await page.$(SINGLE_ISSUE_ANCHOR);
  if (anchor) {
    await anchor.click();
    console.log('✅ 전자(세금)계산서 건별발급 클릭 완료 (ID)');
    return;
  }

  // fallback: 텍스트 포함 매칭
  const spanHandle = await page.evaluateHandle((text) => {
    const spans = Array.from(document.querySelectorAll('span'));
    return spans.find((el) => el.textContent && el.textContent.includes(text)) || null;
  }, SINGLE_ISSUE_SPAN_TEXT);

  const spanEl = spanHandle.asElement();
  if (spanEl) {
    await spanEl.click();
    console.log('✅ 전자(세금)계산서 건별발급 클릭 완료 (텍스트 매칭)');
  } else {
    console.log('⚠️ 전자(세금)계산서 건별발급 항목을 찾지 못했습니다.');
  }
}

module.exports = { waitForMainMenu, openSingleIssue };

