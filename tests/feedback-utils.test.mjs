import test from "node:test";
import assert from "node:assert/strict";
import { FEEDBACK_ISSUE_URL, makeFeedbackUrl } from "../feedback-utils.mjs";

test("留言内容会安全编码并预填到内测仓库 Issue", () => {
  const result = new URL(makeFeedbackUrl({
    school: "中国科学技术大学",
    type: "信息有误",
    device: "手机",
    description: "热水时段需要修改 & 补充",
    steps: "搜索 → 打开详情",
    pageUrl: "https://example.com/?q=中科大"
  }));
  assert.equal(`${result.origin}${result.pathname}`, FEEDBACK_ISSUE_URL);
  assert.equal(result.searchParams.get("title"), "[内测反馈] 信息有误：中国科学技术大学");
  assert.match(result.searchParams.get("body"), /热水时段需要修改 & 补充/);
  assert.match(result.searchParams.get("body"), /搜索 → 打开详情/);
  assert.equal(result.searchParams.get("labels"), "内测反馈");
});

test("选填项留空时使用清晰占位文本", () => {
  const result = new URL(makeFeedbackUrl({ type: "其他问题", description: "测试" }));
  assert.equal(result.searchParams.get("title"), "[内测反馈] 其他问题：网页");
  assert.match(result.searchParams.get("body"), /## 使用设备\n未填写/);
});
