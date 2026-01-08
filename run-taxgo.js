// index-profile 모듈과 홈택스 대기 모듈을 사용해 자동화 실행
const { openCoupangWithPage, rl } = require('./index-profile');
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
const { confirmRetry } = require('./modules/dev-confirm');
const { checkSheetInput, setReadlineInterface } = require('./modules/sheet-input-check');
const { waitForCompletionAndUpdateSheet, setReadlineInterface: setCompletionReadline } = require('./modules/sheet-completion');
const path = require('path');
const fs = require('fs');

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

// 서브모듈 버전 체크 함수
async function checkSubmoduleUpdate() {
  try {
    const releaseUpdaterModule = await import('./submodules/module_update_auto/release_updater.js');
    const ReleaseUpdater = releaseUpdaterModule.default;
    
    const owner = 'bnam91';
    const repo = 'module_update_auto';
    const versionFile = path.join(__dirname, 'submodules', 'module_update_auto', 'SUBMODULE_VERSION.txt');
    
    const updater = new ReleaseUpdater(owner, repo, versionFile);
    const updateSuccess = await updater.updateToLatest();
    
    if (!updateSuccess) {
      console.log('⚠️ 서브모듈 업데이트 체크 실패, 이전 버전으로 계속 진행합니다.');
    }
  } catch (error) {
    console.error('서브모듈 버전 체크 중 오류 발생:', error.message);
    console.log('⚠️ 서브모듈 업데이트 체크를 건너뛰고 계속 진행합니다.');
  }
}

// 메인 프로젝트 버전 체크 함수
async function checkMainProjectUpdate() {
  try {
    const releaseUpdaterModule = await import('./submodules/module_update_auto/release_updater.js');
    const ReleaseUpdater = releaseUpdaterModule.default;
    
    const owner = 'bnam91';
    const repo = 'macro_hometax';
    const versionFile = path.join(__dirname, 'VERSION.txt');
    
    const updater = new ReleaseUpdater(owner, repo, versionFile);
    const updateSuccess = await updater.updateToLatest();
    
    if (!updateSuccess) {
      console.log('⚠️ 메인 프로젝트 업데이트 체크 실패, 이전 버전으로 계속 진행합니다.');
    }
  } catch (error) {
    console.error('메인 프로젝트 버전 체크 중 오류 발생:', error.message);
    console.log('⚠️ 메인 프로젝트 업데이트 체크를 건너뛰고 계속 진행합니다.');
  }
}

(async () => {
  try {
    // 개발 모드 확인
    if (isDevMode) {
      console.log('🚨 개발자 모드입니다');
      console.log('─'.repeat(50));
      console.log('⚠️ 개발 모드에서는 업데이트 체크를 건너뜁니다.');
      console.log('─'.repeat(50));
    } else {
      // 서브모듈 버전 업데이트 체크
      console.log('🔄 서브모듈 버전 체크 중...');
      await checkSubmoduleUpdate();
      console.log('─'.repeat(50));

      // 메인 프로젝트 버전 업데이트 체크
      console.log('🔄 메인 프로젝트 버전 체크 중...');
      await checkMainProjectUpdate();
      console.log('─'.repeat(50));

      // VERSION.txt에서 버전 정보 읽기
      let version = 'unknown';
      try {
        const versionFile = path.join(__dirname, 'VERSION.txt');
        if (fs.existsSync(versionFile)) {
          const versionInfo = JSON.parse(fs.readFileSync(versionFile, 'utf8'));
          version = versionInfo.tag_name || 'unknown';
        }
      } catch (error) {
        console.error('버전 정보 읽기 오류:', error.message);
      }
      console.log(`📦 현재 버전: ${version}`);
      console.log('─'.repeat(50));
    }
  } catch (error) {
    console.error('버전 체크 중 오류 발생:', error.message);
    console.log('⚠️ 버전 체크를 건너뛰고 계속 진행합니다.');
    console.log('─'.repeat(50));
  }

  // readline 인터페이스는 index-profile.js에서 이미 생성됨
  // sheet-input-check에서도 같은 인터페이스 사용
  const { rl: sharedRl } = require('./index-profile');
  setReadlineInterface(sharedRl);
  setCompletionReadline(sharedRl);
  
  // 구글시트 입력 확인 (프로필 선택 전에 먼저 실행)
  await checkSheetInput();

  // 프로필 선택 및 브라우저 열기
  const result = await openCoupangWithPage();
  if (!result) return;

  const { browser, page } = result;
  setupPopupHandlers(page);

  // 시트 데이터 로드
  const sheetRow = await getFirstActiveRow();
  if (!sheetRow) {
    console.log('⚠️ 시트에서 Y/y 행을 찾지 못했습니다. 실행을 종료합니다.');
    const { rl: sharedRl } = require('./index-profile');
    if (sharedRl && !sharedRl.closed) {
      sharedRl.close();
    }
    process.exit(1);
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
      
      // 발급 완료 확인 및 시트 업데이트
      await waitForCompletionAndUpdateSheet();
      
      // 프로세스 종료
      const { rl: sharedRl } = require('./index-profile');
      if (sharedRl && !sharedRl.closed) {
        sharedRl.close();
      }
      process.exit(0);
    } else {
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
          
          // 발급 완료 확인 및 시트 업데이트
          await waitForCompletionAndUpdateSheet();
          
          // 프로세스 종료
          const { rl: sharedRl } = require('./index-profile');
          if (sharedRl && !sharedRl.closed) {
            sharedRl.close();
          }
          process.exit(0);
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
    // 에러 발생 시에도 readline 인터페이스 닫기
    const { rl: sharedRl } = require('./index-profile');
    if (sharedRl && !sharedRl.closed) {
      sharedRl.close();
    }
    process.exit(1);
  }
})();

