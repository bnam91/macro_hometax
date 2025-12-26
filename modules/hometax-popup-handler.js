/**
 * 홈택스 자동화 중 나타나는 팝업/알럿 처리
 * - alert/confirm/prompt: 메시지를 로그로 남기고 확인(accept)
 * - popup window: 자동으로 닫음
 * @param {import('puppeteer').Page} page
 */
function setupPopupHandlers(page) {
  const mainTarget = page.target();

  // 알럿/컨펌/프롬프트 처리
  page.on('dialog', async (dialog) => {
    try {
      console.log(`⚠️ ALERT: ${dialog.message()}`);
      await dialog.accept();
    } catch (err) {
      console.log(`⚠️ ALERT 처리 중 오류: ${err.message}`);
    }
  });

  // 새 창(팝업) 닫기
  page.on('popup', async (popup) => {
    try {
      await popup.close();
      console.log(`ℹ️ 팝업 창 자동 닫음: ${popup.url()}`);
    } catch (err) {
      console.log(`⚠️ 팝업 닫기 실패: ${err.message}`);
    }
  });

  // targetcreated 이벤트로도 팝업 감지 (opener가 main일 때 닫기)
  page.browser().on('targetcreated', async (target) => {
    try {
      if (target.opener() && target.opener() === mainTarget && target.type() === 'page') {
        const pop = await target.page();
        await pop.close();
        console.log(`ℹ️ 팝업 창 자동 닫음: ${target.url()}`);
      }
    } catch (err) {
      console.log(`⚠️ 팝업(targetcreated) 닫기 실패: ${err.message}`);
    }
  });
}

module.exports = { setupPopupHandlers };

