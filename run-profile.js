// index-profile 모듈과 홈택스 대기 모듈을 사용해 자동화 실행
const { openCoupangWithPage } = require('./index-profile');
const { waitForLoginSuccess } = require('./modules/hometax-waiter');
const { clickHddButtonOnCertModal } = require('./modules/hometax-cert-selector');
const { inputCertPassword } = require('./modules/hometax-password');
const { waitForMainMenu, openSingleIssue } = require('./modules/hometax-menu-check');
const { setupPopupHandlers } = require('./modules/hometax-popup-handler');
const { fillBuyerBizNo, fillBuyerEmail } = require('./modules/hometax-buyer');
const { isAlreadyLoggedIn } = require('./modules/hometax-login-check');
const { printBranchTable, selectBranchByName } = require('./modules/hometax-branch-popup');
const { logBuyerFilledValues } = require('./modules/hometax-buyer-read');
const { setWriteDate } = require('./modules/hometax-date');
const { fillFirstItemRow, logFirstItemRowValues } = require('./modules/hometax-item');
const { ensureClaimSelected } = require('./modules/hometax-receipt');
const { logTotals } = require('./modules/hometax-totals');
const { getFirstActiveRow } = require('./modules/sheet-data');
const { clickIssueButton, waitForUserConfirmClick } = require('./modules/hometax-issue');

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

  // 시트 데이터 로드
  const sheetRow = await getFirstActiveRow();
  if (!sheetRow) {
    console.log('⚠️ 시트에서 Y/y 행을 찾지 못했습니다. 실행을 종료합니다.');
    return;
  }

  // 시트 값 매핑
  const bizNo = sheetRow.bizNo || '';
  const companyName = sheetRow.company || '';
  const writeDateRaw = sheetRow.writeDate || '';
  const itemName = sheetRow.item || '연습';
  const dayValue = sheetRow.day || '15';
  const qtyValue = sheetRow.qty || '1';
  const priceValue = sheetRow.price || '10000';
  const claimValue = sheetRow.claimOrReceipt || '청구';

  const normalizeDigits = (str) => (str || '').replace(/\D/g, '');
  const normalizeDate = (str) => {
    const digits = normalizeDigits(str);
    if (digits.length === 8) return digits; // yyyyMMdd
    if (digits.length === 6) return `20${digits}`; // yyMMdd -> 20yyMMdd
    return digits || '20251224';
  };

  const writeDateDigits = normalizeDate(writeDateRaw);

  try {
    const loggedIn = await isAlreadyLoggedIn(page);
    if (loggedIn) {
      await waitForMainMenu(page);
      await page.waitForTimeout(3000);
      console.log('✅ 로그인 유지 상태 확인: 3초 대기 후 메뉴 진입');
      await openSingleIssue(page);
      await page.waitForTimeout(1000);
      await fillBuyerBizNo(page, bizNo);
      await printBranchTable(page);
      await selectBranchByName(page, companyName || '주식회사 팔도');
      await page.waitForTimeout(500);
      await fillBuyerEmail(page, sheetRow.email);
      await logBuyerFilledValues(page);
      // 작성일자 입력 (3초 대기 후)
      await page.waitForTimeout(3000);
      await setWriteDate(page, writeDateDigits);
      // 품목 입력 (1초 대기 후)
      await page.waitForTimeout(1000);
      await fillFirstItemRow(page, {
        day: dayValue,
        item: itemName,
        qty: qtyValue,
        price: normalizeDigits(priceValue) || priceValue,
      });
      await logFirstItemRowValues(page);
      await ensureClaimSelected(page, claimValue);
      await page.waitForTimeout(500);
      await logTotals(page);
      await clickIssueButton(page);
      await waitForUserConfirmClick(page);
    } else {
      await waitForLoginSuccess(page);
      const maxAttempts = 30;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          const picked = await clickHddButtonOnCertModal(page);
          if (picked?.hasCert === false) {
            console.log('⚠️ 유효한 인증서가 없어 비밀번호 입력을 건너뜁니다.');
            if (attempt < maxAttempts) {
              console.log('ℹ️ 잠시 대기 후 인증서 목록을 다시 확인합니다.');
              await page.waitForTimeout(1200);
              continue;
            } else {
              console.log('⚠️ 재시도 한도를 초과했습니다. 드라이브/인증서를 확인해주세요.');
              break;
            }
          }
          await inputCertPassword(page, picked?.pickedText || '');
          await waitForMainMenu(page);
          // 최종 로그인 후 3초 대기 (이동 없음)
          await page.waitForTimeout(3000);
          console.log('✅ 최종 로그인 완료 후 3초 대기 완료 (URL 이동 없음)');
          await openSingleIssue(page);
          // 건별발급 화면 로딩 대기 후 입력 수행
          await page.waitForTimeout(1000);
          await fillBuyerBizNo(page, bizNo);
          await printBranchTable(page);
          await selectBranchByName(page, companyName || '주식회사 팔도');
          await page.waitForTimeout(500);
          await fillBuyerEmail(page, sheetRow.email);
          await logBuyerFilledValues(page);
          await page.waitForTimeout(3000);
          await setWriteDate(page, writeDateDigits);
          await page.waitForTimeout(1000);
          await fillFirstItemRow(page, {
            day: dayValue,
            item: itemName,
            qty: qtyValue,
            price: normalizeDigits(priceValue) || priceValue,
          });
          await logFirstItemRowValues(page);
          await ensureClaimSelected(page, claimValue);
          await page.waitForTimeout(500);
          await logTotals(page);
          await clickIssueButton(page);
          await waitForUserConfirmClick(page);
          // 인증서 팝업 재등장 시 비밀번호만 입력 (확인 클릭 생략)
          const pickedAgain = await clickHddButtonOnCertModal(page);
          await inputCertPassword(page, pickedAgain?.pickedText || '', { clickConfirm: false });
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

