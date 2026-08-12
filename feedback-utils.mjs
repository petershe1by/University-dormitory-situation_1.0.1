export const FEEDBACK_ISSUE_URL = "https://github.com/petershe1by/University-dormitory-situation_1.0.1/issues/new";

function clean(value, fallback = "未填写") {
  const result = String(value ?? "").trim();
  return result || fallback;
}

export function makeFeedbackUrl({ school, type, device, description, steps, pageUrl }) {
  const locationText = clean(school);
  const typeText = clean(type, "其他问题");
  const descriptionText = clean(description);
  const deviceText = clean(device);
  const stepsText = clean(steps);
  const titleTarget = locationText === "未填写" ? "网页" : locationText;
  const title = `[内测反馈] ${typeText}：${titleTarget}`;
  const body = [
    "## 反馈位置",
    locationText,
    "",
    "## 问题类型",
    typeText,
    "",
    "## 问题描述",
    descriptionText,
    "",
    "## 如何复现",
    stepsText,
    "",
    "## 使用设备",
    deviceText,
    "",
    "---",
    `页面地址：${clean(pageUrl)}`,
    "由内测网页的留言反馈表单生成。"
  ].join("\n");
  const params = new URLSearchParams({ title, body, labels: "内测反馈" });
  return `${FEEDBACK_ISSUE_URL}?${params.toString()}`;
}
