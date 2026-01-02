const puppeteer = require('puppeteer');
const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const readline = require('readline');

// readline 인터페이스 생성
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// 사용자 입력을 Promise로 변환하는 헬퍼 함수
function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      // 입력을 trim하여 앞뒤 공백 제거 (중복 입력 방지)
      resolve(answer.trim());
    });
  });
}

// 프로필 이름에 google_ 접두사 추가 (없으면 추가)
function addGooglePrefix(profileName) {
  if (!profileName) return profileName;
  if (profileName.startsWith('google_')) {
    return profileName;
  }
  return `google_${profileName}`;
}

// 프로필 이름에서 google_ 접두사 제거 (표시용)
function removeGooglePrefix(profileName) {
  if (!profileName) return profileName;
  if (profileName.startsWith('google_')) {
    return profileName.substring(7); // 'google_'.length = 7
  }
  return profileName;
}

// config.js에서 설정 읽기
function loadConfig() {
  const configPath = path.join(__dirname, 'config.js');

  try {
    if (!fs.existsSync(configPath)) {
      console.error(`\n❌ config.js 파일을 찾을 수 없습니다.`);
      console.error(`프로젝트 루트에 config.js 파일을 생성하고 설정을 입력해주세요.`);
      console.error(`예시: module.exports = { userDataParent: '경로', startUrl: 'https://example.com' };\n`);
      process.exit(1);
    }

    // require 캐시를 피해서 최신 설정을 읽어오기 위해 삭제
    delete require.cache[require.resolve(configPath)];
    const config = require(configPath);

    if (!config || typeof config !== 'object') {
      throw new Error('config.js가 객체를 내보내지 않습니다.');
    }

    const { userDataParent, startUrl, defaultProfile } = config;

    if (!userDataParent) {
      throw new Error('userDataParent가 비어있습니다.');
    }

    if (!startUrl) {
      throw new Error('startUrl이 비어있습니다.');
    }

    return { userDataParent, startUrl, defaultProfile };
  } catch (error) {
    console.error(`\n❌ config.js 읽기 오류: ${error.message}\n`);
    process.exit(1);
  }
}

// 사용 가능한 프로필 목록을 가져옴
async function getAvailableProfiles(userDataParent) {
  const profiles = [];
  
  try {
    await fsPromises.access(userDataParent);
  } catch {
    await fsPromises.mkdir(userDataParent, { recursive: true });
    return profiles;
  }
  
  try {
    const items = await fsPromises.readdir(userDataParent);
    for (const item of items) {
      const itemPath = path.join(userDataParent, item);
      try {
        const stats = await fsPromises.stat(itemPath);
        if (stats.isDirectory()) {
          const defaultPath = path.join(itemPath, 'Default');
          let hasDefault = false;
          try {
            await fsPromises.access(defaultPath);
            hasDefault = true;
          } catch {}
          
          let hasProfile = false;
          if (!hasDefault) {
            const subItems = await fsPromises.readdir(itemPath);
            for (const subItem of subItems) {
              const subItemPath = path.join(itemPath, subItem);
              try {
                const subStats = await fsPromises.stat(subItemPath);
                if (subStats.isDirectory() && subItem.startsWith('Profile')) {
                  hasProfile = true;
                  break;
                }
              } catch {}
            }
          }
          
          if (hasDefault || hasProfile) {
            // google_로 시작하는 프로필만 추가
            if (item.startsWith('google_')) {
              profiles.push(item);
            }
          }
        }
      } catch {}
    }
  } catch (e) {
    console.log(`프로필 목록 읽기 중 오류: ${e.message}`);
  }
  
  return profiles;
}

// 사용자에게 프로필을 선택하도록 함 (desiredProfile이 주어지면 자동 선택 시도)
async function selectProfile(userDataParent, desiredProfile) {
  const profiles = await getAvailableProfiles(userDataParent);
  
  // 원하는 프로필이 지정된 경우 자동 선택 시도
  if (desiredProfile && profiles.length > 0) {
    const desired = addGooglePrefix(desiredProfile);
    // google_가 이미 붙은 입력도 처리
    const candidates = [desiredProfile, desired];
    const found = profiles.find((p) => candidates.includes(p) || candidates.includes(removeGooglePrefix(p)));
    if (found) {
      const displayName = removeGooglePrefix(found);
      console.log(`\n자동 선택된 프로필: ${displayName}`);
      return found;
    } else {
      console.log(`\n⚠️ 지정한 프로필을 찾을 수 없습니다: ${desiredProfile}`);
    }
  }

  if (profiles.length === 0) {
    console.log("\n사용 가능한 프로필이 없습니다.");
    const createNew = (await question("새 프로필을 생성하시겠습니까? (y/n): ")).toLowerCase();
    if (createNew === 'y') {
      while (true) {
        const name = await question("새 프로필 이름을 입력하세요: ");
        if (!name) {
          console.log("프로필 이름을 입력해주세요.");
          continue;
        }
        
        if (/[\\/:*?"<>|]/.test(name)) {
          console.log("프로필 이름에 다음 문자를 사용할 수 없습니다: \\ / : * ? \" < > |");
          continue;
        }
        
        // google_ 접두사 추가
        const profileNameWithPrefix = addGooglePrefix(name);
        const newProfilePath = path.join(userDataParent, profileNameWithPrefix);
        
        // 접두사가 추가된 이름으로 프로필 존재 여부 확인
        try {
          await fsPromises.access(newProfilePath);
          console.log(`'${profileNameWithPrefix}' 프로필이 이미 존재합니다.`);
          continue;
        } catch {}
        
        try {
          await fsPromises.mkdir(newProfilePath, { recursive: true });
          await fsPromises.mkdir(path.join(newProfilePath, 'Default'), { recursive: true });
          console.log(`'${profileNameWithPrefix}' 프로필이 생성되었습니다.`);
          return profileNameWithPrefix;
        } catch (e) {
          console.log(`프로필 생성 중 오류가 발생했습니다: ${e.message}`);
          const retry = (await question("다시 시도하시겠습니까? (y/n): ")).toLowerCase();
          if (retry !== 'y') {
            return null;
          }
        }
      }
    }
    return null;
  }
  
  console.log("\n사용 가능한 프로필 목록:");
  profiles.forEach((profile, idx) => {
    // 표시할 때는 google_ 접두사 제거
    const displayName = removeGooglePrefix(profile);
    console.log(`${idx + 1}. ${displayName}`);
  });
  console.log(`${profiles.length + 1}. 새 프로필 생성`);
  
  while (true) {
    try {
      const choiceStr = await question("\n사용할 프로필 번호를 선택하세요: ");
      const choice = parseInt(choiceStr);
      
      if (1 <= choice && choice <= profiles.length) {
        const selectedProfile = profiles[choice - 1];
        const displayName = removeGooglePrefix(selectedProfile);
        console.log(`\n선택된 프로필: ${displayName}`);
        return selectedProfile; // 실제 프로필 이름(접두사 포함) 반환
      } else if (choice === profiles.length + 1) {
        // 새 프로필 생성
        while (true) {
          const name = await question("새 프로필 이름을 입력하세요: ");
          if (!name) {
            console.log("프로필 이름을 입력해주세요.");
            continue;
          }
          
          if (/[\\/:*?"<>|]/.test(name)) {
            console.log("프로필 이름에 다음 문자를 사용할 수 없습니다: \\ / : * ? \" < > |");
            continue;
          }
          
          // google_ 접두사 추가
          const profileNameWithPrefix = addGooglePrefix(name);
          const newProfilePath = path.join(userDataParent, profileNameWithPrefix);
          
          // 접두사가 추가된 이름으로 다시 확인
          try {
            await fsPromises.access(newProfilePath);
            console.log(`'${profileNameWithPrefix}' 프로필이 이미 존재합니다.`);
            continue;
          } catch {}
          
          try {
            await fsPromises.mkdir(newProfilePath, { recursive: true });
            await fsPromises.mkdir(path.join(newProfilePath, 'Default'), { recursive: true });
            console.log(`'${profileNameWithPrefix}' 프로필이 생성되었습니다.`);
            return profileNameWithPrefix;
          } catch (e) {
            console.log(`프로필 생성 중 오류가 발생했습니다: ${e.message}`);
            const retry = (await question("다시 시도하시겠습니까? (y/n): ")).toLowerCase();
            if (retry !== 'y') {
              break;
            }
          }
        }
      } else {
        console.log("유효하지 않은 번호입니다. 다시 선택해주세요.");
      }
    } catch (e) {
      console.log("숫자를 입력해주세요.");
    }
  }
}

// 브라우저를 열고 페이지 객체를 반환 (자동화용)
async function openCoupangWithPage() {
  let browser;
  
  try {
    // 사용자 설정 불러오기 (경로, 시작 URL)
    const { userDataParent, startUrl, defaultProfile } = loadConfig();
    
    // 프로필 선택
    const selectedProfile = await selectProfile(userDataParent, defaultProfile);
    if (!selectedProfile) {
      console.log("프로필을 선택할 수 없습니다. 프로그램을 종료합니다.");
      rl.close();
      return null;
    }
    
    const userDataDir = path.join(userDataParent, selectedProfile);
    
    // 프로필 디렉토리가 없으면 생성
    try {
      await fsPromises.access(userDataDir);
    } catch {
      await fsPromises.mkdir(userDataDir, { recursive: true });
      await fsPromises.mkdir(path.join(userDataDir, 'Default'), { recursive: true });
    }
    
    // Chrome 경로
    const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    
    // 브라우저 실행 옵션
    const options = {
      headless: false,
      defaultViewport: null,
      userDataDir: userDataDir,
      args: [
        '--start-maximized',
        '--no-sandbox',
        '--disable-blink-features=AutomationControlled',
        // 캐시 크기 제한 (100MB로 제한)
        '--disk-cache-size=104857600',
        // 메모리 캐시 크기 제한 (50MB로 제한)
        '--media-cache-size=52428800',
        // 백그라운드 네트워킹 비활성화 (불필요한 데이터 저장 방지)
        '--disable-background-networking',
        // 서비스 워커 비활성화 (캐시 누적 방지)
        '--disable-background-timer-throttling',
      ],
      ignoreHTTPSErrors: true,
    };
    
    // Chrome이 있으면 사용
    if (fs.existsSync(chromePath)) {
      options.executablePath = chromePath;
    }

    browser = await puppeteer.launch(options);
    console.log('✅ 크롬이 열렸습니다. 종료하려면 Ctrl+C를 누르세요.\n');

    // 첫 번째 페이지 사용
    const pages = await browser.pages();
    const page = pages[0];

    // 설정된 URL로 이동
    await page.goto(startUrl);

    // 새 탭 열기 (주석처리)
    // const newPage = await browser.newPage();
    // await newPage.goto('https://www.kebhana.com/transfer/index.do');

    // 브라우저 종료 감지
    browser.on('disconnected', () => {
      console.log('브라우저가 닫혔습니다.');
      process.exit(0);
    });

    // 입력 인터페이스 정리
    rl.close();

    return { browser, page };
  } catch (error) {
    console.error('오류:', error.message);
    rl.close();
    process.exit(1);
  } finally {
  }
}

// 기존 동작: 브라우저만 열어두고 대기
async function openCoupang() {
  const result = await openCoupangWithPage();
  if (!result) return;
  
  try {
    // 무한 대기
    await new Promise(() => {});
  } catch (error) {
    console.error('오류:', error.message);
    process.exit(1);
  }
}

// Ctrl+C 종료 처리
process.on('SIGINT', async () => {
  console.log('\n종료 중...');
  rl.close();
  process.exit(0);
});

// 모듈/직접 실행 모두 지원
if (require.main === module) {
  openCoupang();
}

module.exports = { openCoupang, openCoupangWithPage, rl };

