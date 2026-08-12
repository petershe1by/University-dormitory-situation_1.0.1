import { readFile } from "node:fs/promises";
import { classifyBinary, classifyPower, classifyShower, roomNumbers, SEARCH_FIELDS } from "../search-utils.mjs";

const raw = await readFile(new URL("../dorm_data.json", import.meta.url), "utf8");
const records = JSON.parse(raw);
if (!Array.isArray(records) || records.length < 3000) throw new Error("数据记录数量异常");

const required = ["省份", "城市", "院校名称", "层次", "性质"];
const missingRequired = records.flatMap((record, index) => required.filter((field) => !record[field]).map((field) => ({ index, field })));
const contaminated = records.filter((record) => Object.values(record).some((value) => String(value).includes("关注上了么")));
const names = new Set(records.map((record) => record["院校名称"]));

for (const record of records) {
  roomNumbers(record["几人间"]);
  classifyBinary(record["宿舍空调"]);
  classifyPower(record["夜间断电"]);
  classifyShower(record["洗澡热水时段"]);
}

console.log(JSON.stringify({
  records: records.length,
  uniqueSchoolNames: names.size,
  searchableFields: SEARCH_FIELDS.length,
  missingRequired: missingRequired.length,
  contaminatedRows: contaminated.length
}, null, 2));

if (missingRequired.length > 10) throw new Error(`核心字段缺失过多：${missingRequired.length}`);
