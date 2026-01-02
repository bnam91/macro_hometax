/**
 * 환경 설정 파일
 * - userDataParent: 크롬 사용자 데이터 상위 폴더 경로
 * - startUrl: 처음 열 탭의 URL
 */
module.exports = {
  userDataParent: 'C:\\\\Users\\\\신현빈\\\\Desktop\\\\github\\\\user_data',
  // startUrl: 'https://www.google.com',
  startUrl: 'https://hometax.go.kr/',
  // 인증서 선택창에서 사용할 드라이브 이름(포함 매칭). 예: 'Seagate', '로컬 디스크 (C)'
  driveName: 'Seagate Backup Plus Drive',
  // driveIndex: 1, // 이름 대신 순번(0부터)으로 선택하고 싶다면 사용
  // 인증서 목록에서 선택할 이름(포함 매칭)
  certName: '신현빈(goyaandmedia)',
  // certIndex: 0, // 이름 매칭 실패 시 사용할 순번(0부터). 지정하지 않으면 첫 항목
  // 인증서 비밀번호 (우선순위: certPasswords 매핑 → certPassword 기본값)
  certPasswords: [
    { match: '고야앤드미디어', password: '!gusqls120' },
    { match: '신현빈(goyaandmedia)', password: '@gusqls120' },
  ],
  certPassword: '@gusqls120', // 기본값
  // 자동 선택할 프로필 이름(google_ 접두사 없이)
  defaultProfile: 'coq3820@gmail.com',
  // 공급받는자 등록번호 (건별발급 화면)
  buyerBizNo: '3088103161',
};

