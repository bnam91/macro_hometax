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

// readline 인터페이스는 index-profile.js에서 생성된 것을 사용
let rl = null;

/**
 * readline 인터페이스 설정
 */
function setReadlineInterface(readlineInterface) {
  rl = readlineInterface;
}

/**
 * 사용자 입력을 Promise로 변환하는 헬퍼 함수
 */
function question(prompt) {
  if (!rl) {
    throw new Error('readline 인터페이스가 설정되지 않았습니다.');
  }
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

/**
 * 오늘 날짜를 yymmdd 포맷으로 반환
 */
function getTodayDate() {
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2);
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

/**
 * 시트에서 Y로 표시된 첫 번째 행의 행 번호 찾기
 */
async function findFirstActiveRowNumber() {
  const creds = await auth.getCredentials();
  const sheets = google.sheets({ version: 'v4', auth: creds });
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!${RANGE_A1}`,
    majorDimension: 'ROWS',
  });
  
  const rows = res.data.values || [];
  if (!rows || rows.length === 0) return null;
  
  // 헤더 제외하고 데이터 행만 확인 (인덱스 1부터)
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const flag = (row[17] || '').toString().trim().toUpperCase(); // R열 (인덱스 17)
    if (flag === 'Y') {
      // 행 번호는 1-based이므로 i + 1 반환
      return i + 1;
    }
  }
  
  return null;
}

/**
 * 시트의 R열 값을 업데이트
 * @param {number} rowNumber - 업데이트할 행 번호 (1-based)
 * @param {string} value - 업데이트할 값
 */
async function updateSheetCell(rowNumber, value) {
  try {
    const creds = await auth.getCredentials();
    const sheets = google.sheets({ version: 'v4', auth: creds });
    
    // R열은 18번째 열 (A=1, B=2, ..., R=18)
    const range = `${SHEET_NAME}!R${rowNumber}`;
    
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: range,
      valueInputOption: 'RAW',
      resource: {
        values: [[value]],
      },
    });
    
    console.log(`✅ 시트 R${rowNumber} 셀을 "${value}"로 업데이트했습니다.`);
    return true;
  } catch (error) {
    console.error('시트 업데이트 중 오류 발생:', error.message);
    return false;
  }
}

/**
 * 사용자에게 done 입력을 받고 시트를 업데이트하는 메인 함수
 */
async function waitForCompletionAndUpdateSheet() {
  try {
    // 사용자 입력 받기
    const input = await question('발급완료되었다면 done을 입력하세요: ');
    
    if (input.trim().toLowerCase() !== 'done') {
      console.log('⚠️ "done"이 입력되지 않아 시트를 업데이트하지 않습니다.');
      return false;
    }
    
    // Y로 표시된 첫 번째 행 찾기
    const rowNumber = await findFirstActiveRowNumber();
    if (!rowNumber) {
      console.log('⚠️ 시트에서 Y로 표시된 행을 찾지 못했습니다.');
      return false;
    }
    
    // 오늘 날짜 생성
    const todayDate = getTodayDate();
    const completionValue = `발급완료_${todayDate}`;
    
    // 시트 업데이트
    const success = await updateSheetCell(rowNumber, completionValue);
    return success;
  } catch (error) {
    console.error('완료 처리 중 오류 발생:', error.message);
    return false;
  }
}

module.exports = {
  waitForCompletionAndUpdateSheet,
  setReadlineInterface,
};


