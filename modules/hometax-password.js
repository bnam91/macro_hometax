const PASSWORD_INPUT_SELECTORS = [
  '#input_cert_pw',
  'input.passwd_input',
  'input[data-tk-kbdtype]',
  'input[title="비밀번호 입력"]',
];

const CONFIRM_BUTTON_SELECTORS = ['#btn_confirm_iframe', '#btn_confirm'];

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

async function waitForSelectorInAnyFrame(page, selectors, options) {
  const start = Date.now();
  const timeout = options?.timeout ?? 20000;
  const visible = options?.visible ?? true;

  while (Date.now() - start < timeout) {
    for (const frame of page.frames()) {
      for (const sel of selectors) {
        try {
          const handle = await frame.$(sel);
          if (handle) {
            if (visible) {
              const box = await handle.boundingBox();
              const disp = await frame.evaluate(
                (el) => {
                  const style = window.getComputedStyle(el);
                  return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
                },
                handle,
              );
              if (!box || !disp) continue;
            }
            return { frame, handle };
          }
        } catch (err) {
          if (!isContextDestroyed(err)) throw err;
        }
      }
    }
    await page.waitForTimeout(200);
  }
  throw new Error(`selector not found within timeout: ${selectors.join(', ')}`);
}

function resolvePassword(certText, config) {
  const { certPasswords, certPassword } = config;

  if (Array.isArray(certPasswords)) {
    for (const rule of certPasswords) {
      if (rule?.match && rule?.password && certText.includes(rule.match)) {
        return rule.password;
      }
    }
  }

  return certPassword;
}

/**
 * 인증서 비밀번호 입력 (옵션에 따라 확인 클릭)
 * @param {import('puppeteer').Page} page
 * @param {string} pickedCertText 선택된 인증서 텍스트 (로그용)
 * @param {object} options
 * @param {boolean} options.clickConfirm 기본 true, false면 확인 클릭 생략
 */
async function inputCertPassword(page, pickedCertText = '', options = {}) {
  const { clickConfirm = true } = options;
  const config = loadConfig();
  const certPassword = resolvePassword(pickedCertText || '', config);

  if (pickedCertText && pickedCertText.includes('인증서 정보가 없습니다.')) {
    console.log('⚠️ 유효한 인증서가 없어 비밀번호 입력을 건너뜁니다.');
    return;
  }

  if (!certPassword) {
    console.log('⚠️ config.certPassword 가 설정되지 않았습니다. 비밀번호 입력을 건너뜁니다.');
    return;
  }

  const maxAttempts = 2;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      // 입력 필드가 있는 프레임 찾기 (멀티 셀렉터, 프레임 전체 탐색)
      const { frame, handle: inputHandle } = await waitForSelectorInAnyFrame(page, PASSWORD_INPUT_SELECTORS, {
        visible: true,
        timeout: 20000,
      });

      await inputHandle.click({ clickCount: 3 });
      await inputHandle.type(certPassword, { delay: 50 });
      console.log(`✅ 인증서 비밀번호 입력 완료 (cert="${pickedCertText || 'N/A'}")`);

      if (clickConfirm) {
        // 확인 버튼 시도 (여러 후보 셀렉터)
        let clicked = false;
        for (const sel of CONFIRM_BUTTON_SELECTORS) {
          const btn = await frame.$(sel);
          if (btn) {
            // 사용자 입력 대기 대신 1초 대기 후 자동 진행
            await page.waitForTimeout(1000);
            await frame.evaluate((selector) => {
              const el = document.querySelector(selector);
              if (!el) return;
              el.scrollIntoView({ block: 'center', behavior: 'instant' });
              ['mousedown', 'mouseup', 'click'].forEach((type) => {
                el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }));
              });
            }, sel);
            console.log(`✅ 확인 버튼 클릭 완료 (selector: ${sel})`);
            clicked = true;
            break;
          }
        }

        if (!clicked) {
          console.log('⚠️ 확인 버튼을 찾지 못했습니다. 직접 클릭해주세요.');
        }
      } else {
        console.log('ℹ️ 확인 버튼 자동 클릭을 건너뜁니다.');
      }

      return;
    } catch (err) {
      if (isContextDestroyed(err) && attempt < maxAttempts) {
        console.log('⚠️ 페이지/프레임 갱신 감지, 비밀번호 입력을 재시도합니다.');
        await page.waitForTimeout(500);
        continue;
      }
      throw err;
    }
  }
}

module.exports = { inputCertPassword };

