// 인증/키 파일 경로 설정
// 우선순위: 환경변수(API_KEY_DIR) → 아래 기본값
const DEFAULT_API_KEY_DIR = 'C:\\Users\\신현빈\\Desktop\\github\\api_key';

module.exports = {
  API_KEY_DIR: process.env.API_KEY_DIR || DEFAULT_API_KEY_DIR,
};

