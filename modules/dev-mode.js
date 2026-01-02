/**
 * 개발자 모드 확인 유틸리티
 */
function isDevMode() {
  return process.argv.includes('dev') || process.env.NODE_ENV === 'development';
}

/**
 * 개발자 모드에서만 console.log 출력
 */
function devLog(...args) {
  if (isDevMode()) {
    console.log(...args);
  }
}

/**
 * 개발자 모드에서만 console.warn 출력
 */
function devWarn(...args) {
  if (isDevMode()) {
    console.warn(...args);
  }
}

/**
 * 개발자 모드에서만 console.error 출력
 */
function devError(...args) {
  if (isDevMode()) {
    console.error(...args);
  }
}

module.exports = { isDevMode, devLog, devWarn, devError };

