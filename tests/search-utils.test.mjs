import test from "node:test";
import assert from "node:assert/strict";
import {
  classifyBinary,
  classifyPower,
  classifyShower,
  matchesRecord,
  matchesRoom,
  normalizeSearch,
  searchIndex
} from "../search-utils.mjs";

test("宿舍人数使用完整数字匹配，不把 10/11/12 人间当作 1 人间", () => {
  assert.equal(matchesRoom("4、6、8、12", "1"), false);
  assert.equal(matchesRoom("7、10", "1"), false);
  assert.equal(matchesRoom("2、4、6", "2"), true);
  assert.equal(matchesRoom("4、6、10", "9+"), true);
});

test("供电状态区分明确不断电、条件供电和明确断电", () => {
  assert.equal(classifyPower("不断电"), "always");
  assert.equal(classifyPower("冬季23:00断电，夏季不断电"), "conditional");
  assert.equal(classifyPower("东校区不断电; 西校区断电"), "conditional");
  assert.equal(classifyPower("23:00后断电"), "off");
  assert.equal(classifyPower(""), "unknown");
});

test("热水状态识别全天、分时段和混合安排", () => {
  assert.equal(classifyShower("全天"), "all-day");
  assert.equal(classifyShower("24小时"), "all-day");
  assert.equal(classifyShower("15:00-23:00"), "timed");
  assert.equal(classifyShower("老校区分时段; 新校区全天"), "mixed");
  assert.equal(classifyShower("无"), "none");
});

test("设施状态不把空值当作无", () => {
  assert.equal(classifyBinary("有"), "yes");
  assert.equal(classifyBinary("部分有"), "yes");
  assert.equal(classifyBinary("是"), "yes");
  assert.equal(classifyBinary("无"), "no");
  assert.equal(classifyBinary(""), "unknown");
});

test("跨字段搜索忽略常见标点与空格", () => {
  const record = { 院校名称: "中国科学技术大学", 省份: "安徽", 城市: "合肥", 院校地址: "金寨路 96 号" };
  const indexed = { ...record, __search: searchIndex(record) };
  assert.equal(indexed.__search.includes(normalizeSearch("金寨路96号")), true);
  assert.equal(matchesRecord(indexed, { search: "中国科学技术大学", province: "", level: "", room: "", aircon: "", bath: "", power: "", shower: "", features: [] }), true);
});
