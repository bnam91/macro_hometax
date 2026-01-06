// 홈택스 인증서 선택부터 로그인 성공까지 자동화
const { openCoupangWithPage, rl } = require('./index-profile');
const { waitForLoginSuccess } = require('./modules/hometax-waiter');
const { clickHddButtonOnCertModal } = require('./modules/hometax-cert-selector');
const { inputCertPassword } = require('./modules/hometax-password');
const { waitForMainMenu } = require('./modules/hometax-menu-check');
const { setupPopupHandlers } = require('./modules/hometax-popup-handler');
const { isAlreadyLoggedIn } = require('./modules/hometax-login-check');
const { confirmRetry } = require('./modules/dev-confirm');

// 개발자 모드 확인
const isDevMode = process.argv.includes('dev') || process.env.NODE_ENV === 'development';
if (isDevMode) {
  console.log('🔧 개발자 모드로 실행합니다.');
}

function isContextDestroyed(err) {
  const msg = String(err || '');
  return (
    msg.includes('Execution context was destroyed') ||
    msg.includes('Most likely because of a navigation') ||
    msg.includes('Target closed') ||
    msg.includes('Cannot find context with specified id')
  );
}

(async () => {
  const result = await openCoupangWithPage();
  if (!result) return;

  const { browser, page } = result;
  setupPopupHandlers(page);

  try {
    const loggedIn = await isAlreadyLoggedIn(page);
    if (loggedIn) {
      // 이미 로그인되어 있으면 메뉴 진입까지 확인
      await waitForMainMenu(page);
      await page.waitForTimeout(3000);
      console.log('✅ 로그인 유지 상태 확인: 메뉴 진입 완료');
    } else {
      // 로그인 안 되어 있으면 인증서 선택부터 시작
      await waitForLoginSuccess(page);
      const maxAttempts = 30;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          const picked = await clickHddButtonOnCertModal(page);
          if (picked?.hasCert === false) {
            console.log('⚠️ 유효한 인증서가 없어 비밀번호 입력을 건너뜁니다.');
            if (attempt < maxAttempts) {
              // 개발자 모드에서는 사용자 확인 후 재시도
              if (isDevMode) {
                const shouldRetry = await confirmRetry(`[시도 ${attempt}/${maxAttempts}] 재시도 할까요? (Enter: 재시도, 다른 키: 중단)`, rl);
                if (!shouldRetry) {
                  console.log('⚠️ 사용자가 재시도를 중단했습니다.');
                  break;
                }
              } else {
                console.log('ℹ️ 잠시 대기 후 인증서 목록을 다시 확인합니다.');
                await page.waitForTimeout(1200);
              }
              continue;
            } else {
              console.log('⚠️ 재시도 한도를 초과했습니다. 드라이브/인증서를 확인해주세요.');
              break;
            }
          }
          await inputCertPassword(page, picked?.pickedText || '');
          await waitForMainMenu(page);
          // 최종 로그인 후 3초 대기
          await page.waitForTimeout(3000);
          console.log('✅ 로그인 완료: 메뉴 진입 완료');
          break;
        } catch (err) {
          if (isContextDestroyed(err) && attempt < maxAttempts) {
            console.log('⚠️ 페이지/프레임 갱신 감지, 인증서 선택을 재시도합니다.');
            await page.waitForTimeout(1000);
            continue;
          }
          throw err;
        }
      }
    }
  } catch (error) {
    console.error('자동화 중단:', error.message);
  }

  // 브라우저를 열린 상태로 유지
  await new Promise(() => {});
})();


