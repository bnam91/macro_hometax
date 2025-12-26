const BIZ_NO_SELECTOR = '#mf_txppWframe_edtDmnrBsnoTop';
const SUB_BRANCH_SELECTOR = '#mf_txppWframe_edtDmnrMpbNoTop';
const NAME_SELECTOR = '#mf_txppWframe_edtDmnrTnmNmTop';
const REP_NAME_SELECTOR = '#mf_txppWframe_edtDmnrRprsFnmTop';
const ADDRESS_SELECTOR = '#mf_txppWframe_edtDmnrPfbAdrTop';
const BIZ_TYPE_SELECTOR = '#mf_txppWframe_edtDmnrBcNmTop';
const ITEM_SELECTOR = '#mf_txppWframe_edtDmnrItmNmTop';

const EMAIL_ID_SELECTOR = '#mf_txppWframe_edtDmnrMchrgEmlIdTop';
const EMAIL_DOMAIN_INPUT_SELECTOR = '#mf_txppWframe_edtDmnrMchrgEmlDmanTop';
const EMAIL_DOMAIN_SELECT_SELECTOR = '#mf_txppWframe_cmbDmnrMchrgEmlDmanCtlTop';

const EMAIL2_ID_SELECTOR = '#mf_txppWframe_edtDmnrSchrgEmlIdTop';
const EMAIL2_DOMAIN_INPUT_SELECTOR = '#mf_txppWframe_edtDmnrSchrgEmlDmanTop';
const EMAIL2_DOMAIN_SELECT_SELECTOR = '#mf_txppWframe_cmbDmnrSchrgEmlDmanCtlTop';

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

async function readValue(frame, selector) {
  try {
    const val = await frame.$eval(selector, (el) => {
      if (!el) return '';
      const tag = (el.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea') return el.value || '';
      if (tag === 'select') {
        const opt = el.options?.[el.selectedIndex];
        return opt ? opt.textContent || opt.value || '' : el.value || '';
      }
      return el.textContent || '';
    });
    const trimmed = (val || '').trim();
    return trimmed || '-';
  } catch {
    return '-';
  }
}

async function readEmail(frame, idSel, domainInputSel, domainSelectSel) {
  const id = await readValue(frame, idSel);
  const domainInput = await readValue(frame, domainInputSel);
  const domainSelect = await readValue(frame, domainSelectSel);

  const domain =
    domainInput && domainInput !== '-' ? domainInput : domainSelect && domainSelect !== '-' ? domainSelect : '-';

  if (id === '-' || domain === '-') return '-';
  return `${id}@${domain}`;
}

/**
 * 공급받는자 영역 값 출력
 * @param {import('puppeteer').Page} page
 */
async function logBuyerFilledValues(page) {
  const found = await waitForSelectorInAnyFrame(page, BIZ_NO_SELECTOR, { timeout: 8000 });
  if (!found) {
    console.log('ℹ️ 공급받는자 영역을 찾지 못했습니다. (스킵)');
    return;
  }
  const frame = found.frame;

  const bizNo = await readValue(frame, BIZ_NO_SELECTOR);
  const subBranch = await readValue(frame, SUB_BRANCH_SELECTOR);
  const name = await readValue(frame, NAME_SELECTOR);
  const repName = await readValue(frame, REP_NAME_SELECTOR);
  const address = await readValue(frame, ADDRESS_SELECTOR);
  const bizType = await readValue(frame, BIZ_TYPE_SELECTOR);
  const item = await readValue(frame, ITEM_SELECTOR);
  const email1 = await readEmail(frame, EMAIL_ID_SELECTOR, EMAIL_DOMAIN_INPUT_SELECTOR, EMAIL_DOMAIN_SELECT_SELECTOR);
  const email2 = await readEmail(frame, EMAIL2_ID_SELECTOR, EMAIL2_DOMAIN_INPUT_SELECTOR, EMAIL2_DOMAIN_SELECT_SELECTOR);

  console.log('ℹ️ 공급받는자 입력값:');
  console.log(`  등록번호: ${bizNo}`);
  console.log(`  종사업장번호: ${subBranch}`);
  console.log(`  상호: ${name}`);
  console.log(`  성명: ${repName}`);
  console.log(`  사업장: ${address}`);
  console.log(`  업태: ${bizType}`);
  console.log(`  종목: ${item}`);
  console.log(`  이메일1: ${email1}`);
  console.log(`  이메일2: ${email2}`);
}

module.exports = { logBuyerFilledValues };

