const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

const SHEET_URL = 'https://docs.google.com/spreadsheets/d/1mFlHEtlYZXUWTLIpJ2jUKCuvIzHyP4jxvzT1HXpPkzg/edit?gid=2144733096#gid=2144733096';

// readline 인터페이스는 index-profile.js에서 생성된 것을 사용
let rl = null;

/**
 * readline 인터페이스 설정 (index-profile.js에서 호출)
 */
function setReadlineInterface(readlineInterface) {
  rl = readlineInterface;
}

/**
 * 사용자 입력을 Promise로 변환하는 헬퍼 함수
 */
function question(prompt) {
  if (!rl) {
    // rl이 없으면 직접 생성 (fallback)
    const readline = require('readline');
    rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      resolve(answer.trim().toLowerCase());
    });
  });
}

/**
 * 기본 크롬으로 URL 열기 (macOS)
 */
async function openUrlInChrome(url) {
  try {
    await execAsync(`open -a "Google Chrome" "${url}"`);
  } catch (error) {
    console.error('⚠️ 크롬으로 URL을 열 수 없습니다:', error.message);
    throw error;
  }
}

/**
 * 구글시트에서 계산서발행 정보를 먼저 입력할지 확인
 * @returns {Promise<boolean>} true면 시트 입력 진행, false면 바로 스크립트 진행
 */
async function askToInputSheetData() {
  const answer = await question('📋 구글시트에서 계산서발행 정보를 먼저 입력하시겠습니까? (y/n): ');
  return answer === 'y' || answer === 'yes';
}

/**
 * 구글시트 URL을 열고 사용자가 입력 완료할 때까지 대기
 * @returns {Promise<void>}
 */
async function openSheetAndWait() {
  console.log(`\n📊 구글시트를 열고 있습니다: ${SHEET_URL}`);
  await openUrlInChrome(SHEET_URL);
  console.log('✅ 구글시트가 열렸습니다. 계산서발행 정보를 입력해주세요.\n');
  
  // 사용자가 입력 완료할 때까지 대기
  while (true) {
    const answer = await question('입력이 완료되어 계속 진행하려면 y를 입력하세요: ');
    if (answer === 'y' || answer === 'yes') {
      console.log('✅ 입력 완료 확인. 스크립트를 계속 진행합니다.\n');
      break;
    } else {
      console.log('⚠️ y를 입력해주세요.\n');
    }
  }
}

/**
 * 구글시트 입력 확인 프로세스 (프로필 선택 전에 실행)
 * @returns {Promise<boolean>} true면 시트 입력 진행했음, false면 바로 진행
 */
async function checkSheetInput() {
  const shouldInput = await askToInputSheetData();
  
  if (shouldInput) {
    await openSheetAndWait();
    return true;
  }
  
  return false;
}

module.exports = { checkSheetInput, askToInputSheetData, openSheetAndWait, setReadlineInterface };

