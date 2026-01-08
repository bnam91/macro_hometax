const path = require('path');
const dotenv = require('dotenv');
const { google } = require('googleapis');
const { API_KEY_DIR } = require(path.resolve(__dirname, '..', 'auth_config.js'));

const ENV_PATH = path.join(API_KEY_DIR, '.env');

// .env 로드
dotenv.config({ path: ENV_PATH, override: false });

// auth.js 모듈
const auth = require(path.join(API_KEY_DIR, 'auth.js'));

const SPREADSHEET_ID = '1mFlHEtlYZXUWTLIpJ2jUKCuvIzHyP4jxvzT1HXpPkzg';
const SHEET_NAME = '세금계산서(발행)';
const RANGE_A1 = 'A1:R2000';

async function fetchSheet() {
  const creds = await auth.getCredentials();
  const sheets = google.sheets({ version: 'v4', auth: creds });
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!${RANGE_A1}`,
    majorDimension: 'ROWS',
  });
  return res.data.values || [];
}

function pickRow(row) {
  const get = (idx) => (row[idx] ?? '').toString().trim();
  const digitsOnly = (str) => (str || '').replace(/\D/g, '');
  return {
    alias: get(1), // B
    company: get(2), // C
    bizNoRaw: get(3), // D (원본)
    bizNo: digitsOnly(get(3)), // D (숫자만)
    email: get(4), // E
    writeDate: get(5), // F
    day: get(7), // H
    total: get(8), // I
    item: get(9), // J
    qty: get(11), // L
    price: get(12), // M
    supply: get(13), // N
    tax: get(14), // O
    claimOrReceipt: get(16), // Q
    flag: get(17), // R (Y/y)
  };
}

async function getFirstActiveRow() {
  const rows = await fetchSheet();
  if (!rows || rows.length === 0) return null;
  const dataRows = rows.slice(1); // 헤더 제외
  const matched = dataRows.map(pickRow).filter((r) => r.flag.toUpperCase() === 'Y');
  return matched[0] || null;
}

/**
 * 거래처 시트에서 별칭으로 데이터 조회
 * @param {string} alias - 별칭 (예: '채빈(꾸미다홈)')
 * @returns {Object|null} 거래처 정보 { companyName, repName } 또는 null
 */
async function getBuyerInfoByAlias(alias) {
  if (!alias) return null;
  
  try {
    const creds = await auth.getCredentials();
    const sheets = google.sheets({ version: 'v4', auth: creds });
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: '거래처!A1:H2000',
      majorDimension: 'ROWS',
    });
    
    const rows = res.data.values || [];
    if (!rows || rows.length === 0) return null;
    
    // 헤더 제외하고 데이터 행만 확인 (인덱스 1부터)
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const rowAlias = (row[0] || '').toString().trim(); // 컬럼 0: 별칭
      
      if (rowAlias === alias) {
        const companyName = (row[1] || '').toString().trim(); // 컬럼 1: 상호
        const repName = (row[3] || '').toString().trim(); // 컬럼 3: 성명1
        
        if (companyName || repName) {
          return {
            companyName: companyName || null,
            repName: repName || null,
          };
        }
      }
    }
    
    return null;
  } catch (error) {
    console.error('거래처 시트 조회 중 오류 발생:', error.message);
    return null;
  }
}

module.exports = { getFirstActiveRow, getBuyerInfoByAlias };

