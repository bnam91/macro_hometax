const path = require("path");
const dotenv = require("dotenv");
const { google } = require("googleapis");

const { API_KEY_DIR } = require(path.resolve(__dirname, "auth_config.js"));
const ENV_PATH = path.join(API_KEY_DIR, ".env");

// .env 파일 로드
dotenv.config({ path: ENV_PATH, override: false });

// auth.js 모듈 가져오기
const auth = require(path.join(API_KEY_DIR, "auth.js"));

async function fetchFirstFiveRows(spreadsheetId, sheetName) {
  const creds = await auth.getCredentials();
  const sheets = google.sheets({ version: "v4", auth: creds });
  const rangeA1 = `${sheetName}!A1:Z5`;

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: rangeA1,
    majorDimension: "ROWS",
  });

  const values = res.data.values || [];
  return values;
}

async function main() {
  const spreadsheetId = "1YWiFGyJjNDbOC8eFTbS1HEhmxfZAC-hLvI8KdA1Gku8";
  const sheetName = "테스트";

  try {
    const rows = await fetchFirstFiveRows(spreadsheetId, sheetName);
    if (!rows || rows.length === 0) {
      console.log("데이터가 없습니다.");
      return;
    }
    rows.forEach((row, idx) => {
      console.log(`[${idx}]\t` + row.map(String).join("\t"));
    });
  } catch (e) {
    console.error("Google Sheets API 호출 실패:", e);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}


