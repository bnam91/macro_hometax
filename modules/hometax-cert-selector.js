const DEFAULT_TIMEOUT = 60000;
const MODAL_SELECTOR = '#ML_window';
const HDD_BUTTON_SELECTOR = '#stg_hdd';
const DRIVER_MENU_SELECTOR = '#driver_div';
const CERT_TABLE_SELECTOR = '#tabledataTable';
const RETRY_MOUSE_EVENTS = ['mouseover', 'mouseenter', 'mousedown', 'mouseup', 'click'];
const { devLog, devWarn } = require('./dev-mode');
const CONFIG = (() => {
  try {
    // 모듈 캐시 무시하고 최신 config 로드
    delete require.cache[require.resolve('../config')];
    return require('../config');
  } catch (err) {
    devWarn('⚠️ config 로드 실패, 드라이브 선택은 기본값으로 진행:', err.message);
    return {};
  }
})();

async function waitForSelectorInAnyFrame(page, selector, options) {
  const start = Date.now();
  const timeout = options?.timeout ?? DEFAULT_TIMEOUT;

  while (Date.now() - start < timeout) {
    // frames()는 동기적으로 가져온다.
    for (const frame of page.frames()) {
      const handle = await frame.$(selector);
      if (handle) {
        return { frame, handle };
      }
    }
    await page.waitForTimeout(300);
  }

  throw new Error(`selector not found within timeout: ${selector}`);
}

async function isDriverMenuVisible(frame) {
  return frame.$eval(
    DRIVER_MENU_SELECTOR,
    (el) => {
      const style = window.getComputedStyle(el);
      return style.display !== 'none' && style.visibility !== 'hidden';
    },
  );
}

async function waitForDriverMenuVisible(frame, timeoutMs = 5000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const visible = await isDriverMenuVisible(frame).catch(() => false);
    if (visible) return true;
    await frame.waitForTimeout(200);
  }
  return false;
}

async function logDriveList(frame) {
  try {
    await frame.waitForSelector('#sub_drv_list li', { timeout: 3000 });
    const items = await frame.$$('#sub_drv_list li');
    const driveTexts = await Promise.all(
      items.map((item) => item.$eval('a', (a) => a.textContent.trim())),
    );
    devLog(`ℹ️ 드라이브 목록 (${driveTexts.length}개):`);
    driveTexts.forEach((txt, idx) => devLog(`  [${idx}] ${txt}`));
  } catch (err) {
    devWarn(`⚠️ 드라이브 목록 로깅 실패: ${err.message}`);
  }
}

async function logCertificateList(frame) {
  try {
    const rows = await frame.$$eval(`${CERT_TABLE_SELECTOR} tbody tr`, (trs) =>
      trs.map((tr) => tr.innerText.trim()),
    );
    devLog(`ℹ️ 인증서 목록 (${rows.length}개):`);
    rows.forEach((txt, idx) => devLog(`  [${idx}] ${txt}`));
  } catch (err) {
    devWarn(`⚠️ 인증서 목록 로깅 실패: ${err.message}`);
  }
}

async function pickDrive(frame) {
  const driveName = CONFIG.driveName;
  const driveIndex = CONFIG.driveIndex;

  // 리스트 등장 대기
  await frame.waitForSelector('#sub_drv_list li', { timeout: 3000 });
  const items = await frame.$$('#sub_drv_list li');
  
  // 드라이브 목록 출력
  await logDriveList(frame);

  if (driveName) {
    // 이름 매칭 (CERT_001 (1) 같은 경우, 'CERT_001'로 시작하는지 확인)
    for (let i = 0; i < items.length; i++) {
      const text = await items[i].$eval('a', (a) => a.textContent.trim());
      if (text.startsWith(driveName)) {
        await items[i].click();
        devLog(`✅ 드라이브 이름 매칭 클릭: "${text}"`);
        // 드라이브 클릭 후 인증서 목록 로드 대기
        await frame.waitForTimeout(1000);
        return;
      }
    }
    devWarn(`⚠️ 이름 매칭 실패: "${driveName}"`);
  }

  if (Number.isInteger(driveIndex) && driveIndex >= 0 && driveIndex < items.length) {
    const text = await items[driveIndex].$eval('a', (a) => a.textContent.trim());
    await items[driveIndex].click();
    devLog(`✅ 드라이브 인덱스(${driveIndex}) 클릭: "${text}"`);
    // 드라이브 클릭 후 인증서 목록 로드 대기
    await frame.waitForTimeout(1000);
    return;
  }

  // fallback: 첫 번째 항목
  const text = await items[0].$eval('a', (a) => a.textContent.trim());
  await items[0].click();
  devWarn(`⚠️ 설정에 맞는 드라이브를 찾지 못해 첫 항목 클릭: "${text}"`);
  // 드라이브 클릭 후 인증서 목록 로드 대기
  await frame.waitForTimeout(1000);
}

async function pickCertificate(frame) {
  const certName = CONFIG.certName;
  const certIndex = CONFIG.certIndex;

  // 테이블이 나타날 때까지 대기
  await frame.waitForSelector(`${CERT_TABLE_SELECTOR} tbody tr`, { timeout: 5000 });
  
  // 실제 인증서 데이터가 로드될 때까지 대기 (placeholder가 아닌 실제 데이터)
  // 최대 5초 동안 대기하며, 실제 인증서 데이터가 나타나는지 확인
  let rowTexts = [];
  let hasRealData = false;
  const maxWaitTime = 5000;
  const checkInterval = 300;
  const startTime = Date.now();
  
  while (Date.now() - startTime < maxWaitTime) {
    rowTexts = await frame.$$eval(`${CERT_TABLE_SELECTOR} tbody tr`, (trs) =>
      trs.map((tr) => tr.innerText.trim()),
    );
    
    // 실제 인증서 데이터가 있는지 확인 (placeholder가 아닌 경우)
    hasRealData = rowTexts.length > 0 && 
      !rowTexts.every((txt) => txt.includes('인증서 정보가 없습니다.'));
    
    if (hasRealData) {
      break;
    }
    
    await frame.waitForTimeout(checkInterval);
  }
  
  await logCertificateList(frame);

  // 유효 인증서가 없는 경우 (placeholder만 있는 경우)
  if (
    rowTexts.length === 0 ||
    rowTexts.every((txt) => txt.includes('인증서 정보가 없습니다.'))
  ) {
    console.log('⚠️ 유효한 인증서가 없어 클릭을 건너뜁니다.');
    return { pickedText: '인증서 정보가 없습니다.', targetIndex: -1, hasCert: false };
  }

  let targetIndex = 0;

  // 이름 포함 매칭
  if (certName) {
    for (let i = 0; i < rowTexts.length; i++) {
      if (rowTexts[i].includes(certName)) {
        targetIndex = i;
        break;
      }
    }
    if (!rowTexts[targetIndex]?.includes(certName)) {
      devWarn(`⚠️ 인증서 이름 매칭 실패: "${certName}"`);
    }
  }

  // 인덱스 매칭
  if (Number.isInteger(certIndex) && certIndex >= 0 && certIndex < rowTexts.length) {
    targetIndex = certIndex;
  }

  // 클릭을 안전하게 수행 (DOM 재렌더 대비)
  await frame.evaluate(
    (selector, idx) => {
      const rows = Array.from(document.querySelectorAll(`${selector} tbody tr`));
      if (!rows[idx]) throw new Error(`row index out of range: ${idx}`);
      const row = rows[idx];
      row.scrollIntoView({ block: 'center', behavior: 'instant' });
      // 우선 a 태그를 클릭하고, 없으면 셀을 클릭
      const anchor = row.querySelector('a') || row.querySelector('td') || row;
      anchor.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
      anchor.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
      anchor.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
    },
    CERT_TABLE_SELECTOR,
    targetIndex,
  );

  // 선택 상태 확인
  const pickedText = rowTexts[targetIndex] ?? 'N/A';
  const selectedInfo = await frame.evaluate(
    (selector, idx) => {
      const rows = Array.from(document.querySelectorAll(`${selector} tbody tr`));
      const row = rows[idx];
      if (!row) return { selected: false, className: 'missing' };
      const selected = row.className.includes('selected') || row.querySelector('.MLjqui-grid-cell-selected') !== null;
      return { selected, className: row.className };
    },
    CERT_TABLE_SELECTOR,
    targetIndex,
  );

  devLog(`✅ 인증서 클릭 시도: [${targetIndex}] ${pickedText}`);
  devLog(`ℹ️ 선택 상태: selected=${selectedInfo.selected}, class=${selectedInfo.className}`);

  return { pickedText, targetIndex, hasCert: true };
}

/**
 * 공인인증서 선택창이 뜨면 하드디스크/이동식 버튼을 클릭
 * @param {import('puppeteer').Page} page
 * @param {number} timeoutMs 대기 시간 (기본 60초)
 */
async function clickHddButtonOnCertModal(page, timeoutMs = DEFAULT_TIMEOUT) {
  // 모달 등장 대기
  const modalFound = await waitForSelectorInAnyFrame(page, MODAL_SELECTOR, { timeout: timeoutMs });
  devLog(`✅ 인증서 선택창 감지 (frame url: ${modalFound.frame.url() || 'about:blank'})`);

  // 버튼 클릭
  const { frame } = await waitForSelectorInAnyFrame(page, HDD_BUTTON_SELECTOR, { timeout: timeoutMs });
  devLog(`ℹ️ 버튼이 있는 frame url: ${frame.url() || 'about:blank'}`);

  const btnHandle = await frame.$(HDD_BUTTON_SELECTOR);

  const before = await frame.evaluate(
    (btn, driverSelector) => {
      const driver = document.querySelector(driverSelector);
      const style = driver ? window.getComputedStyle(driver) : null;
      return {
        btnDisplay: window.getComputedStyle(btn).display,
        btnClasses: btn.className,
        driverDisplay: style ? style.display : 'missing',
      };
    },
    btnHandle,
    DRIVER_MENU_SELECTOR,
  );
  devLog(`ℹ️ 클릭 전 상태: btnDisplay=${before.btnDisplay}, driverDisplay=${before.driverDisplay}, btnClasses=${before.btnClasses}`);

  await btnHandle.hover();
  await btnHandle.click({ delay: 50 });
  devLog('✅ 하드디스크/이동식 버튼 기본 클릭 시도');

  let shown = await waitForDriverMenuVisible(frame, 3000);

  // 보이지 않으면 마우스 이벤트를 한번 더 강제 발생
  if (!shown) {
    devWarn('⚠️ 드라이브 목록이 보이지 않아 추가 이벤트 시도');
    await frame.evaluate(
      (selector, events) => {
        const el = document.querySelector(selector);
        if (!el) return;
        for (const type of events) {
          el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }));
        }
      },
      HDD_BUTTON_SELECTOR,
      RETRY_MOUSE_EVENTS,
    );
    await frame.waitForTimeout(500);
    shown = await waitForDriverMenuVisible(frame, 3000);
  }

  if (shown) {
    devLog('✅ 드라이브 목록 표시됨');
    await pickDrive(frame);
    const picked = await pickCertificate(frame);
    return picked;
  } else {
    const after = await frame.evaluate((driverSelector) => {
      const driver = document.querySelector(driverSelector);
      if (!driver) return { driverDisplay: 'missing' };
      const style = window.getComputedStyle(driver);
      return {
        driverDisplay: style.display,
        driverVisibility: style.visibility,
        html: driver.outerHTML.substring(0, 200),
      };
    }, DRIVER_MENU_SELECTOR);
    devWarn(`❌ 드라이브 목록 표시 실패. 상태: ${JSON.stringify(after)}`);
  }
}

module.exports = { clickHddButtonOnCertModal, waitForSelectorInAnyFrame, logDriveList };

