/**
 * 개발자 모드에서 사용자에게 재시도 확인 질문
 * @param {string} message 확인 메시지
 * @param {object} rlInterface readline 인터페이스 (index-profile.js에서 전달, 선택사항)
 * @returns {Promise<boolean>} true면 재시도, false면 중단
 */
async function confirmRetry(message = '재시도 할까요? (Enter: 재시도, 다른 키: 중단)', rlInterface = null) {
  // rlInterface가 제공되지 않으면 index-profile.js에서 가져오기 시도
  if (!rlInterface) {
    try {
      const { rl } = require('../index-profile');
      rlInterface = rl;
    } catch (e) {
      // index-profile.js가 아직 로드되지 않았거나 rl을 export하지 않은 경우
      // 직접 생성하지 않고 에러 발생 (중복 인터페이스 방지)
      throw new Error('readline 인터페이스를 찾을 수 없습니다. index-profile.js가 먼저 로드되어야 합니다.');
    }
  }
  
  return new Promise((resolve) => {
    rlInterface.question(`${message} `, (answer) => {
      // 입력을 trim하여 앞뒤 공백 제거
      const trimmed = answer.trim();
      // 엔터만 치면 (빈 문자열) 재시도
      const shouldRetry = trimmed === '';
      resolve(shouldRetry);
    });
  });
}

module.exports = { confirmRetry };

