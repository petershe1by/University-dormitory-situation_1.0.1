const EMPTY_VALUES = new Set(["", "none", "null", "undefined", "不确定", "未知", "暂无", "暂无数据"]);

export function text(value) {
  return value == null ? "" : String(value).trim();
}

export function isKnown(value) {
  return !EMPTY_VALUES.has(text(value).toLowerCase());
}

export function normalizeSearch(value) {
  return text(value)
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[\s·•・,，。；;：:（）()\-_/]+/g, "");
}

export function roomNumbers(value) {
  if (!isKnown(value) || text(value).includes("关注")) return [];
  const numbers = text(value).match(/\d{1,2}/g) || [];
  return [...new Set(numbers.map(Number).filter((number) => number > 0 && number <= 30))];
}

export function matchesRoom(value, query) {
  if (!query) return true;
  const numbers = roomNumbers(value);
  if (query === "9+") return numbers.some((number) => number >= 9);
  return numbers.includes(Number(query));
}

export function classifyPower(value) {
  const raw = text(value);
  if (!isKnown(raw)) return "unknown";
  if (raw === "不断电") return "always";
  if (raw.includes("不断电")) return "conditional";
  if (raw.includes("断电")) return "off";
  return "unknown";
}

export function classifyShower(value) {
  const raw = text(value);
  if (!isKnown(raw)) return "unknown";
  if (raw === "无" || /没有|无热水/.test(raw)) return "none";
  const allDay = /全天|24\s*(小时|h)?/i.test(raw);
  const timed = /分时段|定时|\d{1,2}\s*[:：]\s*\d{2}|\d{1,2}\s*[点时]\s*[-—至到]/.test(raw);
  if (allDay && (timed || /部分|校区/.test(raw))) return "mixed";
  if (allDay) return "all-day";
  if (timed) return "timed";
  return "unknown";
}

export function classifyBinary(value) {
  const raw = text(value);
  if (!isKnown(raw)) return "unknown";
  if (raw === "无" || raw === "否" || raw.startsWith("无，") || raw.startsWith("无,")) return "no";
  if (raw === "是" || /有|部分/.test(raw) && !raw.includes("没有")) return "yes";
  return "unknown";
}

export function positiveFacility(value) {
  return classifyBinary(value) === "yes";
}

export function featureMatches(record, feature) {
  switch (feature) {
    case "public": return text(record["性质"]) === "公办";
    case "undergrad": return text(record["层次"]) === "本科";
    case "desk": return text(record["上床下桌"]) === "是";
    case "aircon": return positiveFacility(record["宿舍空调"]);
    case "bath": return positiveFacility(record["独立卫浴"]);
    case "power": return classifyPower(record["夜间断电"]) === "always";
    case "hotwater": return classifyShower(record["洗澡热水时段"]) === "all-day";
    case "laundry": return positiveFacility(record["洗衣机"]);
    case "metro": return positiveFacility(record["地铁"]);
    default: return true;
  }
}

export const SEARCH_FIELDS = [
  "院校名称", "省份", "城市", "城市类", "院校地址", "层次", "性质", "⭐存在多校区",
  "上床下桌", "几人间", "宿舍空调", "教室空调", "独立卫浴", "洗澡热水时段", "洗衣机",
  "通宵自习室", "宿舍限电瓦数", "夜间断电", "夜间断网", "校园网速度", "校园网价格",
  "大一带电脑", "查寝情况", "晚归门禁时间", "早晚自习", "晨跑要求", "跑步打卡要求",
  "地铁", "⭐市区距离", "学校交通便利", "点外卖", "食堂价格感受", "超市价格感受",
  "收发快递", "共享单车"
];

export const CORE_FIELDS = [
  "几人间", "上床下桌", "宿舍空调", "独立卫浴", "洗澡热水时段", "洗衣机",
  "宿舍限电瓦数", "夜间断电", "夜间断网", "校园网速度", "查寝情况",
  "晚归门禁时间", "地铁", "学校交通便利", "收发快递"
];

export function searchIndex(record) {
  return normalizeSearch(SEARCH_FIELDS.map((field) => record[field]).filter(Boolean).join(" "));
}

export function coverage(record) {
  const known = CORE_FIELDS.filter((field) => isKnown(record[field])).length;
  return Math.round((known / CORE_FIELDS.length) * 100);
}

export function matchesRecord(record, filters) {
  if (filters.search && !record.__search.includes(normalizeSearch(filters.search))) return false;
  if (filters.province && text(record["省份"]) !== filters.province) return false;
  if (filters.level && text(record["层次"]) !== filters.level) return false;
  if (!matchesRoom(record["几人间"], filters.room)) return false;
  if (filters.aircon && classifyBinary(record["宿舍空调"]) !== filters.aircon) return false;
  if (filters.bath && classifyBinary(record["独立卫浴"]) !== filters.bath) return false;
  if (filters.power && classifyPower(record["夜间断电"]) !== filters.power) return false;
  if (filters.shower && classifyShower(record["洗澡热水时段"]) !== filters.shower) return false;
  return filters.features.every((feature) => featureMatches(record, feature));
}
