const path = require("path");
const dotenv = require("dotenv");
const { google } = require("googleapis");

const { API_KEY_DIR } = require(path.resolve(__dirname, "auth_config.js"));
const ENV_PATH = path.join(API_KEY_DIR, ".env");

// .env 파일 로드
dotenv.config({ path: ENV_PATH, override: false });

// auth.js 모듈 가져오기
const auth = require(path.join(API_KEY_DIR, "auth.js"));

async function fetchSheet(spreadsheetId, sheetName, rangeA1 = "A1:R1000") {
  const creds = await auth.getCredentials();
  const sheets = google.sheets({ version: "v4", auth: creds });
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!${rangeA1}`,
    majorDimension: "ROWS",
  });
  return res.data.values || [];
}

function pickRow(row) {
  // 안전하게 인덱스 접근
  const get = (idx) => (row[idx] ?? "").toString().trim();
  const digitsOnly = (str) => (str || "").replace(/\D/g, "");
  return {
    alias: get(1), // B
    company: get(2), // C
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

async function main() {
  const spreadsheetId = "1mFlHEtlYZXUWTLIpJ2jUKCuvIzHyP4jxvzT1HXpPkzg";
  const sheetName = "세금계산서(발행)";

  try {
    const rows = await fetchSheet(spreadsheetId, sheetName, "A1:R2000");
    if (!rows || rows.length === 0) {
      console.log("데이터가 없습니다.");
      return;
    }

    // 첫 행이 헤더라고 가정
    const dataRows = rows.slice(1);
    const matched = dataRows
      .map(pickRow)
      .filter((r) => r.flag.toUpperCase() === "Y");

    if (matched.length === 0) {
      console.log("Y/y 로 표시된 행이 없습니다.");
      return;
    }

    matched.forEach((r, idx) => {
      console.log(`--- 매칭 행 ${idx + 1} ---`);
      console.log(`별칭(B): ${r.alias}`);
      console.log(`상호명(C): ${r.company}`);
      console.log(`사업자등록번호(D): ${r.bizNo}`);
      console.log(`이메일(E): ${r.email}`);
      console.log(`작성일자(F): ${r.writeDate}`);
      console.log(`일(H): ${r.day}`);
      console.log(`합계금액(I): ${r.total}`);
      console.log(`품목명(J): ${r.item}`);
      console.log(`수량(L): ${r.qty}`);
      console.log(`단가(M): ${r.price}`);
      console.log(`공급가액(N): ${r.supply}`);
      console.log(`세액(O): ${r.tax}`);
      console.log(`청구/영수(Q): ${r.claimOrReceipt}`);
    });
  } catch (e) {
    console.error("Google Sheets API 호출 실패:", e);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}


