const MAIN_HEADER_SELECTOR = '#mf_wfHeader_memUserInfo, #mf_wfHeader_group1503, #tmpUsrNm';

/**
 * 세션이 살아 있어 이미 로그인된 상태인지 확인
 * @param {import('puppeteer').Page} page
 * @param {number} timeoutMs
 * @returns {Promise<boolean>}
 */
async function isAlreadyLoggedIn(page, timeoutMs = 4000) {
  try {
    await page.waitForSelector(MAIN_HEADER_SELECTOR, { visible: true, timeout: timeoutMs });
    console.log('ℹ️ 기존 세션 감지: 이미 로그인 상태로 판단합니다.');
    return true;
  } catch {
    return false;
  }
}

module.exports = { isAlreadyLoggedIn };

