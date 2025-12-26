const POPUP_SELECTOR = '#mf_txppWframe_ABTIBsnoUnitPopup2';
const TABLE_SELECTOR = '#mf_txppWframe_ABTIBsnoUnitPopup2_wframe_grid1';
const CONFIRM_BTN_SELECTOR = '#mf_txppWframe_ABTIBsnoUnitPopup2_wframe_trigger66';
const MAX_TABLE_WAIT_MS = 8000;
const TABLE_POLL_INTERVAL_MS = 300;

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
 * 종사업장 선택 팝업의 테이블 내용을 로그로 출력
 * @param {import('puppeteer').Page} page
 * @param {number} timeoutMs
 */
async function printBranchTable(page, timeoutMs = 8000) {
  const found = await waitForSelectorInAnyFrame(page, POPUP_SELECTOR, { timeout: timeoutMs });
  if (!found) {
    console.log('ℹ️ 종사업장 선택 팝업이 나타나지 않아 스킵합니다.');
    return;
  }

  const frame = found.frame;

  try {
    const header = await frame.$$eval(`${TABLE_SELECTOR} thead tr th`, (ths) =>
      ths.map((th) => th.innerText.trim()).filter(Boolean),
    );
    const rows = await frame.$$eval(`${TABLE_SELECTOR} tbody tr`, (trs) =>
      trs.map((tr) =>
        Array.from(tr.querySelectorAll('td')).map((td) => td.innerText.trim()),
      ),
    );

    console.log(`ℹ️ 종사업장 선택 팝업 감지. 헤더: ${header.join(' | ')}`);
    if (!rows.length) {
      console.log('⚠️ 테이블에 데이터가 없습니다.');
      return;
    }
    rows.forEach((cols, idx) => {
      console.log(`  [${idx}] ${cols.join(' | ')}`);
    });
  } catch (err) {
    console.log(`⚠️ 종사업장 테이블 로깅 실패: ${err.message}`);
  }
}

/**
 * 상호 텍스트를 포함하는 행을 선택하고 '선택' 버튼 클릭
 * @param {import('puppeteer').Page} page
 * @param {string} targetName 포함 매칭할 상호 텍스트
 * @param {number} timeoutMs
 */
async function selectBranchByName(page, targetName, timeoutMs = 8000) {
  const found = await waitForSelectorInAnyFrame(page, POPUP_SELECTOR, { timeout: timeoutMs });
  if (!found) {
    console.log('ℹ️ 종사업장 선택 팝업이 나타나지 않아 선택을 건너뜁니다.');
    return;
  }

  const frame = found.frame;

  // 테이블 로딩 대기 및 데이터 폴링
  let rowIndex = -1;
  const start = Date.now();
  while (Date.now() - start < MAX_TABLE_WAIT_MS) {
    rowIndex = await frame.$eval(
      `${TABLE_SELECTOR} tbody`,
      (tbody, name) => {
        const trs = Array.from(tbody.querySelectorAll('tr'));
        for (let i = 0; i < trs.length; i++) {
          const text = trs[i].innerText || '';
          if (text.includes(name)) return i;
        }
        return -1;
      },
      targetName,
    );
    if (rowIndex >= 0) break;
    await frame.waitForTimeout(TABLE_POLL_INTERVAL_MS);
  }

  if (rowIndex < 0) {
    console.log(`⚠️ 상호에 '${targetName}'가 포함된 행을 찾지 못했습니다.`);
    return;
  }

  // 라디오 클릭
  await frame.evaluate(
    (selector, idx) => {
      const rows = Array.from(document.querySelectorAll(`${selector} tbody tr`));
      const row = rows[idx];
      if (!row) return;
      const radio = row.querySelector('input[type="radio"]') || row.querySelector('input');
      const target = radio || row;
      target.scrollIntoView({ block: 'center', behavior: 'instant' });
      ['mousedown', 'mouseup', 'click'].forEach((type) => {
        target.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }));
      });
    },
    TABLE_SELECTOR,
    rowIndex,
  );

  console.log(`✅ 종사업장 행 선택 완료: index=${rowIndex}, 상호 포함='${targetName}'`);

  // 선택 버튼 클릭
  const confirmBtn = await frame.$(CONFIRM_BTN_SELECTOR);
  if (confirmBtn) {
    await frame.evaluate((sel) => {
      const btn = document.querySelector(sel);
      if (!btn) return;
      btn.scrollIntoView({ block: 'center', behavior: 'instant' });
      ['mousedown', 'mouseup', 'click'].forEach((type) => {
        btn.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }));
      });
    }, CONFIRM_BTN_SELECTOR);
    console.log('✅ 종사업장 선택 팝업 - 선택 버튼 클릭 완료');
  } else {
    console.log('⚠️ 종사업장 선택 버튼을 찾지 못했습니다.');
  }
}

module.exports = { printBranchTable, selectBranchByName };

