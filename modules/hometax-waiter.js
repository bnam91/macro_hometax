const TARGET_SELECTOR = '#mf_txppWframe_loginboxFrame_anchor22';

/**
 * 홈택스 로그인 성공 여부를 기다렸다가 1초 후 클릭합니다.
 * @param {import('puppeteer').Page} page
 * @param {number} timeoutMs 대기 시간 (기본 60초)
 */
async function waitForLoginSuccess(page, timeoutMs = 60000) {
  try {
    await page.waitForSelector(TARGET_SELECTOR, { visible: true, timeout: timeoutMs });
    console.log('✅ 로그인 성공: 타겟 요소가 나타났습니다.');

    // 1초 대기 후 클릭
    await page.waitForTimeout(1000);
    await page.click(TARGET_SELECTOR);
    console.log('✅ 타겟 요소 클릭 완료');
  } catch (error) {
    console.error(`❌ 로그인 성공 요소 대기/클릭 실패: ${error.message}`);
    throw error;
  }
}

module.exports = { waitForLoginSuccess };

