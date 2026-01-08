const INPUT_SELECTOR = '#mf_txppWframe_edtDmnrBsnoTop';
const CONFIRM_BUTTON_SELECTOR = '#mf_txppWframe_btnDmnrBsnoCnfrTop';
const EMAIL_ID_SELECTOR = '#mf_txppWframe_edtDmnrMchrgEmlIdTop';
const EMAIL_DOMAIN_SELECTOR = '#mf_txppWframe_edtDmnrMchrgEmlDmanTop';
const EMAIL_SELECT_SELECTOR = '#mf_txppWframe_cmbDmnrMchrgEmlDmanCtlTop';

function loadConfig() {
  delete require.cache[require.resolve('../config')];
  return require('../config');
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

async function waitForSelectorInAnyFrame(page, selector, options = {}) {
  const start = Date.now();
  const timeout = options.timeout ?? 15000;

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

  throw new Error(`selector not found within timeout: ${selector}`);
}

/**
 * 공급받는자 등록번호 입력 후 확인 클릭
 * @param {import('puppeteer').Page} page
 * @param {string} bizNo 기본값은 config.buyerBizNo
 */
async function fillBuyerBizNo(page, bizNoFromParam) {
  const config = loadConfig();
  const bizNo = bizNoFromParam || config.buyerBizNo;

  if (!bizNo) {
    console.log('⚠️ buyerBizNo가 설정되지 않아 입력을 건너뜁니다.');
    return;
  }

  // 입력 필드 찾기
  const { frame, handle: inputHandle } = await waitForSelectorInAnyFrame(page, INPUT_SELECTOR, {
    timeout: 20000,
  });
  // 한 템포 대기 (화면 반영 지연 방지)
  await frame.waitForTimeout(500);

  await inputHandle.click({ clickCount: 3 });
  await inputHandle.type(bizNo, { delay: 50 });
  // 입력값 검증 및 보정
  const expected = bizNo.replace(/\D/g, '');
  let value = await frame.$eval(INPUT_SELECTOR, (el) => el.value.trim());
  let digits = value.replace(/\D/g, '');    

  if (digits !== expected) {
    console.log(`⚠️ 입력값 불일치 감지(현재: ${digits}, 기대: ${expected}) 재입력 시도`);
    await frame.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (el) el.value = '';
    }, INPUT_SELECTOR);
    await inputHandle.click({ clickCount: 3 });
    await inputHandle.type(bizNo, { delay: 50 });
    await frame.waitForTimeout(300);
    value = await frame.$eval(INPUT_SELECTOR, (el) => el.value.trim());
    digits = value.replace(/\D/g, '');
  }

  if (digits !== expected) {
    console.log(`❌ 입력값 검증 실패(현재: ${digits}, 기대: ${expected}) 확인 클릭을 건너뜁니다.`);
    return;
  }

  // 값 확정 및 입력 이벤트 발생 (페이지 측에서 검증하는 경우 대비)
  await frame.evaluate(
    (selector, finalVal) => {
      const el = document.querySelector(selector);
      if (!el) return;
      el.value = finalVal;
      ['input', 'change', 'keyup'].forEach((type) => {
        el.dispatchEvent(new Event(type, { bubbles: true }));
      });
    },
    INPUT_SELECTOR,
    expected,
  );

  // WebSquare 컴포넌트에 직접 반영 시도 (있을 경우)
  await frame.evaluate((val) => {
    try {
      if (window.$p && $p.getComponentById) {
        const cmp = $p.getComponentById('mf_txppWframe_edtDmnrBsnoTop');
        if (cmp && cmp.setValue) cmp.setValue(val);
      }
    } catch (e) {
      // 무시하고 진행
    }
  }, expected);

  // 최종 값 재확인
  const finalValue = await frame.$eval(INPUT_SELECTOR, (el) => el.value.trim());
  const finalDigits = finalValue.replace(/\D/g, '');
  console.log(`✅ 공급받는자 등록번호 입력 완료: ${finalValue} (digits=${finalDigits})`);

  // 확인 버튼 클릭
  const confirmBtn = await frame.$(CONFIRM_BUTTON_SELECTOR);
  if (confirmBtn) {
    // 입력 후 1초 대기
    await frame.waitForTimeout(1000);
    await frame.evaluate((selector) => {
      const btn = document.querySelector(selector);
      const wrapper = btn?.closest('.btn_event') || btn?.parentElement;
      const target = btn || wrapper;
      if (!target) return;
      target.scrollIntoView({ block: 'center', behavior: 'instant' });
      ['mousedown', 'mouseup', 'click'].forEach((type) => {
        target.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }));
      });
    }, CONFIRM_BUTTON_SELECTOR);
    console.log('✅ 공급받는자 등록번호 확인 버튼 클릭 완료');
  } else {
    console.log('⚠️ 공급받는자 확인 버튼을 찾지 못했습니다.');
  }
}

module.exports = { fillBuyerBizNo };

async function fillBuyerEmail(page, email) {
  if (!email || !email.includes('@')) {
    console.log('ℹ️ 이메일이 없거나 잘못된 형식입니다. 입력을 건너뜁니다.');
    return;
  }

  const [localPart, domainPart] = email.split('@');
  const found = await waitForSelectorInAnyFrame(page, EMAIL_ID_SELECTOR, { timeout: 8000 });
  if (!found) {
    console.log('⚠️ 이메일 입력 필드를 찾지 못했습니다.');
    return;
  }
  const { frame } = found;

  // select를 직접입력으로 설정 시도
  await frame.evaluate((sel) => {
    const select = document.querySelector(sel);
    if (select) {
      select.value = '직접입력';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }, EMAIL_SELECT_SELECTOR);

  // 입력 함수
  const setInput = async (sel, val) => {
    try {
      const handle = await frame.$(sel);
      if (!handle) return;
      await handle.click({ clickCount: 3 });
      await handle.type(val, { delay: 30 });
      await frame.evaluate((s) => {
        const el = document.querySelector(s);
        if (!el) return;
        ['input', 'change', 'blur', 'keyup'].forEach((type) => {
          el.dispatchEvent(new Event(type, { bubbles: true }));
        });
      }, sel);
    } catch (e) {
      console.log(`⚠️ 이메일 입력 실패 (${sel}): ${e.message}`);
    }
  };

  await setInput(EMAIL_ID_SELECTOR, localPart);
  await setInput(EMAIL_DOMAIN_SELECTOR, domainPart);

  console.log(`✅ 이메일 입력 완료: ${localPart}@${domainPart}`);
}

/**
 * 공급받는자 상호 입력
 * @param {import('puppeteer').Page} page
 * @param {string} companyName - 상호명
 */
async function fillBuyerCompanyName(page, companyName) {
  if (!companyName || companyName === '-') {
    return;
  }

  const NAME_SELECTOR = '#mf_txppWframe_edtDmnrTnmNmTop';
  const found = await waitForSelectorInAnyFrame(page, NAME_SELECTOR, { timeout: 8000 });
  if (!found) {
    console.log('⚠️ 상호 입력 필드를 찾지 못했습니다.');
    return;
  }
  const { frame, handle } = found;

  try {
    await handle.click({ clickCount: 3 });
    await handle.type(companyName, { delay: 50 });
    await frame.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) return;
      ['input', 'change', 'blur', 'keyup'].forEach((type) => {
        el.dispatchEvent(new Event(type, { bubbles: true }));
      });
    }, NAME_SELECTOR);
    console.log(`✅ 상호 입력 완료: ${companyName}`);
  } catch (error) {
    console.error('상호 입력 중 오류 발생:', error.message);
  }
}

/**
 * 공급받는자 성명 입력
 * @param {import('puppeteer').Page} page
 * @param {string} repName - 성명
 */
async function fillBuyerRepName(page, repName) {
  if (!repName || repName === '-') {
    return;
  }

  const REP_NAME_SELECTOR = '#mf_txppWframe_edtDmnrRprsFnmTop';
  const found = await waitForSelectorInAnyFrame(page, REP_NAME_SELECTOR, { timeout: 8000 });
  if (!found) {
    console.log('⚠️ 성명 입력 필드를 찾지 못했습니다.');
    return;
  }
  const { frame, handle } = found;

  try {
    await handle.click({ clickCount: 3 });
    await handle.type(repName, { delay: 50 });
    await frame.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) return;
      ['input', 'change', 'blur', 'keyup'].forEach((type) => {
        el.dispatchEvent(new Event(type, { bubbles: true }));
      });
    }, REP_NAME_SELECTOR);
    console.log(`✅ 성명 입력 완료: ${repName}`);
  } catch (error) {
    console.error('성명 입력 중 오류 발생:', error.message);
  }
}

module.exports = { fillBuyerBizNo, fillBuyerEmail, fillBuyerCompanyName, fillBuyerRepName };

