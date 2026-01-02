// 인증/키 파일 경로 설정
// 우선순위: 환경변수(API_KEY_DIR) → 아래 기본값
const os = require('os');
const path = require('path');

const expandHomeDir = (dirPath) => {
  if (dirPath.startsWith('~/')) {
    return path.join(os.homedir(), dirPath.slice(2));
  }
  return dirPath;
};

const DEFAULT_API_KEY_DIR = expandHomeDir('~/Documents/github_cloud/module_auth');

module.exports = {
  API_KEY_DIR: process.env.API_KEY_DIR ? expandHomeDir(process.env.API_KEY_DIR) : DEFAULT_API_KEY_DIR,
};

