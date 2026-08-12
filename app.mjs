import {
  SEARCH_FIELDS,
  classifyBinary,
  classifyPower,
  classifyShower,
  coverage,
  isKnown,
  matchesRecord,
  normalizeSearch,
  searchIndex,
  text
} from "./search-utils.mjs";

const PAGE_SIZE = 24;
const state = { records: [], filtered: [], page: 1, filters: null, queryTimer: null };

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const controls = {
  search: $("#searchInput"),
  province: $("#provinceFilter"),
  level: $("#levelFilter"),
  room: $("#roomFilter"),
  aircon: $("#airconFilter"),
  bath: $("#bathFilter"),
  power: $("#powerFilter"),
  shower: $("#showerFilter"),
  sort: $("#sortSelect")
};

const FEATURE_LABELS = {
  public: "公办", undergrad: "本科", desk: "上床下桌", aircon: "宿舍有空调",
  bath: "有独立卫浴", power: "夜间不断电", hotwater: "全天热水",
  laundry: "有洗衣机", metro: "附近有地铁"
};

const FILTER_LABELS = {
  province: "地区", level: "层次", room: "人数", aircon: "空调",
  bath: "卫浴", power: "供电", shower: "热水"
};

const DETAIL_GROUPS = [
  ["院校与校区", [["院校地址", "院校地址"], ["多校区", "⭐存在多校区"], ["城市类别", "城市类"], ["距市区", "⭐市区距离"], ["交通便利", "学校交通便利"]]],
  ["住宿设施", [["房间人数", "几人间"], ["上床下桌", "上床下桌"], ["宿舍空调", "宿舍空调"], ["独立卫浴", "独立卫浴"], ["洗澡热水", "洗澡热水时段"], ["洗衣机", "洗衣机"], ["宿舍限电", "宿舍限电瓦数"]]],
  ["作息与管理", [["夜间断电", "夜间断电"], ["夜间断网", "夜间断网"], ["查寝情况", "查寝情况"], ["晚归门禁", "晚归门禁时间"], ["早晚自习", "早晚自习"], ["晨跑要求", "晨跑要求"], ["跑步打卡", "跑步打卡要求"]]],
  ["学习与网络", [["教室空调", "教室空调"], ["通宵自习室", "通宵自习室"], ["校园网速度", "校园网速度"], ["校园网价格", "校园网价格"], ["大一带电脑", "大一带电脑"]]],
  ["校园生活", [["地铁", "地铁"], ["共享单车", "共享单车"], ["点外卖", "点外卖"], ["食堂价格", "食堂价格感受"], ["超市价格", "超市价格感受"], ["收发快递", "收发快递"]]]
];

function readFilters() {
  return {
    search: controls.search.value.trim(),
    province: controls.province.value,
    level: controls.level.value,
    room: controls.room.value,
    aircon: controls.aircon.value,
    bath: controls.bath.value,
    power: controls.power.value,
    shower: controls.shower.value,
    features: $$(".filter-chip[aria-pressed='true']").map((chip) => chip.dataset.feature)
  };
}

function create(tag, className, content) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (content != null) element.textContent = content;
  return element;
}

function formatNumber(number) {
  return new Intl.NumberFormat("zh-CN").format(number);
}

function valueOrDash(value) {
  return isKnown(value) ? text(value) : "—";
}

function isSafeDisplayValue(value) {
  return isKnown(value) && !text(value).includes("关注上了么");
}

function classificationBadge(label, kind) {
  const badge = create("span", `badge ${kind}`, label);
  return badge;
}

function facilityBadge(label, value) {
  const kind = classifyBinary(value);
  if (kind === "yes") return classificationBadge(label, "good");
  if (kind === "no") return classificationBadge(`${label}：无`, "bad");
  return classificationBadge(`${label}：暂无资料`, "unknown");
}

function powerBadge(value) {
  const kind = classifyPower(value);
  const labels = { always: "夜间不断电", conditional: "供电安排有条件", off: "夜间断电", unknown: "供电暂无资料" };
  const styles = { always: "good", conditional: "warn", off: "bad", unknown: "unknown" };
  return classificationBadge(labels[kind], styles[kind]);
}

function highlight(container, rawText, query) {
  const source = valueOrDash(rawText);
  if (!query) {
    container.textContent = source;
    return;
  }
  const normalizedQuery = normalizeSearch(query);
  if (!normalizedQuery || !normalizeSearch(source).includes(normalizedQuery)) {
    container.textContent = source;
    return;
  }
  const index = source.toLowerCase().indexOf(query.toLowerCase());
  if (index < 0) {
    container.textContent = source;
    return;
  }
  container.append(document.createTextNode(source.slice(0, index)));
  const mark = create("mark", "matched-text", source.slice(index, index + query.length));
  container.append(mark, document.createTextNode(source.slice(index + query.length)));
}

function buildCard(record, index) {
  const card = create("article", "school-card");
  const top = create("div", "card-top");
  const location = create("div", "card-location");
  location.append(create("span", "province-tag", `${valueOrDash(record["省份"])} · ${valueOrDash(record["城市"])}`));
  location.append(create("span", "coverage", `资料完整度 ${record.__coverage}%`));
  const heading = create("h3");
  highlight(heading, record["院校名称"], state.filters.search);
  const address = create("p", "school-address", valueOrDash(record["院校地址"]));
  top.append(location, heading, address);

  const badges = create("div", "card-badges");
  if (isSafeDisplayValue(record["层次"])) badges.append(classificationBadge(text(record["层次"]), ""));
  if (isSafeDisplayValue(record["性质"])) badges.append(classificationBadge(text(record["性质"]), ""));
  badges.append(facilityBadge("空调", record["宿舍空调"]), facilityBadge("独卫", record["独立卫浴"]), powerBadge(record["夜间断电"]));

  const facts = create("dl", "card-facts");
  [["房间人数", record["几人间"]], ["上床下桌", record["上床下桌"]], ["洗澡热水", record["洗澡热水时段"]], ["晚归门禁", record["晚归门禁时间"]]].forEach(([label, value]) => {
    const item = create("div");
    item.append(create("dt", "", label), create("dd", "", isSafeDisplayValue(value) ? text(value) : "—"));
    facts.append(item);
  });

  const detailButton = create("button", "detail-button", "查看 35 项生活信息 →");
  detailButton.type = "button";
  detailButton.dataset.recordIndex = String(index);
  detailButton.setAttribute("aria-label", `查看${valueOrDash(record["院校名称"])}详情`);
  card.append(top, badges, facts, detailButton);
  return card;
}

function sortRecords(records) {
  const sorted = [...records];
  const collator = new Intl.Collator("zh-CN");
  if (controls.sort.value === "province-asc") {
    sorted.sort((a, b) => collator.compare(text(a["省份"]), text(b["省份"])) || collator.compare(text(a["院校名称"]), text(b["院校名称"])));
  } else if (controls.sort.value === "coverage-desc") {
    sorted.sort((a, b) => b.__coverage - a.__coverage || collator.compare(text(a["院校名称"]), text(b["院校名称"])));
  } else {
    sorted.sort((a, b) => collator.compare(text(a["院校名称"]), text(b["院校名称"])));
  }
  return sorted;
}

function renderActiveFilters() {
  const host = $("#activeFilters");
  host.replaceChildren();
  const entries = [];
  if (state.filters.search) entries.push(["搜索", state.filters.search]);
  Object.entries(FILTER_LABELS).forEach(([key, label]) => {
    if (!state.filters[key]) return;
    const control = controls[key];
    const selectedLabel = control?.selectedOptions?.[0]?.textContent || state.filters[key];
    entries.push([label, selectedLabel]);
  });
  state.filters.features.forEach((feature) => entries.push(["条件", FEATURE_LABELS[feature]]));
  if (!entries.length) {
    host.append(create("span", "result-summary", "当前未添加筛选条件"));
    return;
  }
  entries.forEach(([label, value]) => host.append(create("span", "active-token", `${label}：${value}`)));
}

function renderResults({ focusResults = false } = {}) {
  state.filters = readFilters();
  state.filtered = sortRecords(state.records.filter((record) => matchesRecord(record, state.filters)));
  const pageCount = Math.max(1, Math.ceil(state.filtered.length / PAGE_SIZE));
  state.page = Math.min(state.page, pageCount);

  $("#resultCount").textContent = formatNumber(state.filtered.length);
  $("#resultSummary").textContent = state.filtered.length
    ? `每页 ${PAGE_SIZE} 条；“资料完整度”仅表示核心字段填写比例，不代表信息可靠程度。`
    : "没有符合全部条件的记录。";
  $("#searchClear").hidden = !state.filters.search;
  renderActiveFilters();

  const grid = $("#resultGrid");
  grid.replaceChildren();
  $("#emptyState").hidden = state.filtered.length !== 0;
  if (!state.filtered.length) {
    $("#pagination").hidden = true;
    if (focusResults) $("#results").focus({ preventScroll: true });
    return;
  }

  const start = (state.page - 1) * PAGE_SIZE;
  const fragment = document.createDocumentFragment();
  state.filtered.slice(start, start + PAGE_SIZE).forEach((record, pageIndex) => {
    fragment.append(buildCard(record, start + pageIndex));
  });
  grid.append(fragment);

  $("#pagination").hidden = pageCount <= 1;
  $("#pageInfo").textContent = `第 ${state.page} / ${pageCount} 页`;
  $("#prevPage").disabled = state.page === 1;
  $("#nextPage").disabled = state.page === pageCount;
  if (focusResults) $("#results").focus({ preventScroll: true });
}

function resetFilters() {
  Object.values(controls).forEach((control) => {
    if (control === controls.sort) return;
    control.value = "";
  });
  $$(".filter-chip").forEach((chip) => chip.setAttribute("aria-pressed", "false"));
  state.page = 1;
  renderResults();
}

function openDetail(record) {
  $("#detailTitle").textContent = valueOrDash(record["院校名称"]);
  $("#detailMeta").textContent = `${valueOrDash(record["省份"])} · ${valueOrDash(record["城市"])} · ${valueOrDash(record["层次"])} · ${valueOrDash(record["性质"])}`;
  const content = $("#detailContent");
  content.replaceChildren();

  DETAIL_GROUPS.forEach(([title, fields]) => {
    const knownFields = fields.filter(([, key]) => isSafeDisplayValue(record[key]));
    if (!knownFields.length) return;
    const group = create("section", "detail-group");
    group.append(create("h3", "", title));
    const list = create("dl", "detail-list");
    knownFields.forEach(([label, key]) => {
      const item = create("div", "detail-item");
      item.append(create("dt", "", label), create("dd", "", valueOrDash(record[key])));
      list.append(item);
    });
    group.append(list);
    content.append(group);
  });
  $("#detailDialog").showModal();
}

function populateSummary() {
  const names = new Set(state.records.map((record) => text(record["院校名称"])).filter(Boolean));
  const regions = new Set(state.records.map((record) => text(record["省份"])).filter(Boolean));
  $("#recordTotal").textContent = formatNumber(state.records.length);
  $("#schoolTotal").textContent = formatNumber(names.size);
  $("#regionTotal").textContent = formatNumber(regions.size);
  $("#fieldTotal").textContent = String(SEARCH_FIELDS.length);

  [...regions].sort(new Intl.Collator("zh-CN").compare).forEach((region) => {
    const option = create("option", "", region);
    option.value = region;
    controls.province.append(option);
  });
}

async function loadData() {
  $("#loadingState").hidden = false;
  $("#errorState").hidden = true;
  try {
    const response = await fetch("dorm_data.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`服务器返回 ${response.status}`);
    const raw = await response.json();
    if (!Array.isArray(raw)) throw new Error("数据格式不是记录列表");
    state.records = raw.map((record, index) => ({
      ...record,
      __id: index,
      __search: searchIndex(record),
      __coverage: coverage(record)
    }));
    populateSummary();
    state.page = 1;
    renderResults();
    $("#loadingState").hidden = true;
  } catch (error) {
    $("#loadingState").hidden = true;
    $("#errorState").hidden = false;
    $("#errorMessage").textContent = `${error.message}。请确认网页通过 HTTP 服务打开，而不是直接双击本地文件。`;
  }
}

function bindEvents() {
  controls.search.addEventListener("input", () => {
    clearTimeout(state.queryTimer);
    state.queryTimer = setTimeout(() => { state.page = 1; renderResults(); }, 180);
  });
  controls.search.addEventListener("search", () => { state.page = 1; renderResults(); });
  Object.values(controls).filter((control) => control !== controls.search).forEach((control) => {
    control.addEventListener("change", () => { state.page = 1; renderResults(); });
  });
  $$(".filter-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      chip.setAttribute("aria-pressed", String(chip.getAttribute("aria-pressed") !== "true"));
      state.page = 1;
      renderResults();
    });
  });
  $("#resetFilters").addEventListener("click", resetFilters);
  $("#emptyReset").addEventListener("click", resetFilters);
  $("#searchClear").addEventListener("click", () => { controls.search.value = ""; state.page = 1; renderResults(); controls.search.focus(); });
  $("#prevPage").addEventListener("click", () => { state.page -= 1; renderResults(); $("#results").scrollIntoView(); });
  $("#nextPage").addEventListener("click", () => { state.page += 1; renderResults(); $("#results").scrollIntoView(); });
  $("#resultGrid").addEventListener("click", (event) => {
    const button = event.target.closest(".detail-button");
    if (button) openDetail(state.filtered[Number(button.dataset.recordIndex)]);
  });
  $("#dialogClose").addEventListener("click", () => $("#detailDialog").close());
  $("#methodButton").addEventListener("click", () => $("#methodDialog").showModal());
  $("#methodClose").addEventListener("click", () => $("#methodDialog").close());
  $("#retryButton").addEventListener("click", loadData);
  $("#noticeClose").addEventListener("click", () => $(".notice").remove());
  document.addEventListener("keydown", (event) => {
    if (event.key === "/" && !/input|select|textarea/i.test(document.activeElement.tagName)) {
      event.preventDefault();
      controls.search.focus();
    }
  });
  [$("#detailDialog"), $("#methodDialog")].forEach((dialog) => {
    dialog.addEventListener("click", (event) => {
      const rect = dialog.getBoundingClientRect();
      const outside = event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom;
      if (outside) dialog.close();
    });
  });
}

bindEvents();
loadData();
