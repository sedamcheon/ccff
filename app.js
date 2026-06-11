const CATEGORIES = ["전체", "커피", "라떼", "에이드", "아이스티", "티", "주스", "스무디"];
const EMPTY_CAFES = {};
const MENU_ALIASES = {
  "자몽차": "자몽티",
  "자몽 에이드": "자몽에이드",
  "청포도플라워": "청포도에이드",
  "청포도 플라워": "청포도에이드",
  "복숭아에이드": "복숭아 아이스티",
  "레몬 에이드": "레몬에이드",
  "아메리카노": "아이스 아메리카노",
  "다크 아메리카노": "아이스 아메리카노",
  "미디움 아메리카노": "아이스 아메리카노",
  "플레인요거트스무디": "요거트스무디"
};
const CANONICAL_CATEGORIES = {
  "자몽티": "티",
  "자몽에이드": "에이드",
  "청포도에이드": "에이드",
  "복숭아 아이스티": "아이스티",
  "레몬에이드": "에이드",
  "아이스 아메리카노": "커피",
  "요거트스무디": "스무디"
};

const state = {
  cafes: EMPTY_CAFES,
  reports: {},
  selectedCategory: "전체",
  selectedDrink: "",
  activeCafeId: "",
  firebaseReady: false,
  isAdmin: false,
  adminUser: null,
  selectedAdminCafeId: "",
  selectedAdminMenuId: ""
};

const els = {};
const fb = {};

document.addEventListener("DOMContentLoaded", init);

async function init() {
  cacheElements();
  bindEvents();
  renderShell();

  state.cafes = await loadSeedCafes();
  renderAll();

  await initFirebase();
}

function cacheElements() {
  [
    "statusMessage",
    "adminToggle",
    "userView",
    "adminView",
    "backToRank",
    "searchInput",
    "categoryTabs",
    "drinkList",
    "rankingTitle",
    "rankingHelp",
    "rankingList",
    "detailPanel",
    "reportDialog",
    "reportForm",
    "closeReport",
    "reportCafeName",
    "reportDrinkName",
    "reportOldPrice",
    "reportNewPrice",
    "reportMemo",
    "reportMessage",
    "loginForm",
    "adminEmail",
    "adminPassword",
    "adminTools",
    "logoutButton",
    "adminCafeSelect",
    "cafeForm",
    "menuForm",
    "adminMenuList",
    "reportList"
  ].forEach((id) => {
    els[id] = document.getElementById(id);
  });
}

function bindEvents() {
  els.searchInput.addEventListener("input", () => {
    renderDrinkList();
  });

  els.adminToggle.addEventListener("click", () => showAdminView(true));
  els.backToRank.addEventListener("click", () => showAdminView(false));
  els.closeReport.addEventListener("click", () => els.reportDialog.close());
  els.reportForm.addEventListener("submit", submitReport);
  els.loginForm.addEventListener("submit", loginAdmin);
  els.logoutButton.addEventListener("click", logoutAdmin);
  els.adminCafeSelect.addEventListener("change", () => {
    state.selectedAdminCafeId = els.adminCafeSelect.value;
    state.selectedAdminMenuId = "";
    renderAdminTools();
  });
  els.cafeForm.addEventListener("submit", saveCafe);
  els.menuForm.addEventListener("submit", saveMenu);
}

async function initFirebase() {
  const config = window.CAFE1_FIREBASE_CONFIG || {};

  if (!hasFirebaseConfig(config)) {
    hideStatus();
    return;
  }

  try {
    const appModule = await import("https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js");
    const dbModule = await import("https://www.gstatic.com/firebasejs/11.10.0/firebase-database.js");
    const authModule = await import("https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js");

    const app = appModule.initializeApp(config);
    fb.db = dbModule.getDatabase(app);
    fb.auth = authModule.getAuth(app);
    Object.assign(fb, dbModule, authModule);
    state.firebaseReady = true;

    fb.onAuthStateChanged(fb.auth, async (user) => {
      state.adminUser = user;
      state.isAdmin = false;

      if (user) {
        const adminSnap = await fb.get(fb.ref(fb.db, `admins/${user.uid}`));
        state.isAdmin = adminSnap.val() === true;
        if (!state.isAdmin) {
          showStatus(`관리자 권한이 없습니다. admins/${user.uid} 값을 true로 추가하세요.`);
        }
      }

      renderAdminTools();
    });

    fb.onValue(fb.ref(fb.db, "cafes"), async (snapshot) => {
      if (snapshot.exists()) {
        state.cafes = snapshot.val();
        hideStatus();
        renderAll();
        return;
      }

      state.cafes = await loadSeedCafes();
      renderAll();
      await fb.set(fb.ref(fb.db, "cafes"), state.cafes);
      showStatus("cafes 데이터가 비어 있어 기본 카페 6곳을 한 번 저장했습니다.");
    });

    fb.onValue(fb.ref(fb.db, "reports"), (snapshot) => {
      state.reports = snapshot.val() || {};
      renderReports();
    }, () => {
      state.reports = {};
      renderReports();
    });
  } catch (error) {
    showStatus(`Firebase 연결 실패: ${error.message}`);
  }
}

async function loadSeedCafes() {
  try {
    const response = await fetch("./seed-cafes.json", { cache: "no-store" });
    if (!response.ok) {
      throw new Error("seed fetch failed");
    }
    return await response.json();
  } catch {
    return {
      compose_ks_station: {
        name: "컴포즈커피 경성대역사점",
        location: "경성대역사 주변",
        distanceText: "경성대역사 주변",
        distanceMeters: 650,
        hours: "영업시간 확인 필요",
        tags: ["프랜차이즈", "가성비", "테이크아웃 가능"],
        menus: {
          menu_001: { name: "아이스 아메리카노", category: "커피", price: 1500, updatedAt: "2026-06-11" },
          menu_002: { name: "카페라떼", category: "라떼", price: 2900, updatedAt: "2026-06-11" },
          menu_003: { name: "복숭아 아이스티", category: "아이스티", price: 3000, updatedAt: "2026-06-11" }
        }
      }
    };
  }
}

function hasFirebaseConfig(config) {
  return Boolean(
    config.apiKey &&
      config.appId &&
      config.databaseURL &&
      !String(config.apiKey).includes("YOUR_") &&
      !String(config.appId).includes("YOUR_")
  );
}

function renderShell() {
  els.categoryTabs.innerHTML = CATEGORIES.map((category) => (
    `<button class="category-tab ${category === state.selectedCategory ? "active" : ""}" data-category="${escapeHtml(category)}" type="button">${escapeHtml(category)}</button>`
  )).join("");

  els.categoryTabs.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedCategory = button.dataset.category;
      renderShell();
      renderDrinkList();
    });
  });
}

function renderAll() {
  renderShell();
  renderDrinkList();
  renderRankings();
  renderDetail();
  renderAdminTools();
}

function renderDrinkList() {
  const search = normalize(els.searchInput.value);
  const drinks = getDrinkSummaries().filter((drink) => {
    const categoryOk = state.selectedCategory === "전체" || drink.category === state.selectedCategory;
    const searchOk = !search || normalize(drink.name).includes(search);
    return categoryOk && searchOk;
  });

  if (!drinks.length) {
    els.drinkList.innerHTML = `<div class="empty">검색된 음료가 없습니다.</div>`;
    return;
  }

  els.drinkList.innerHTML = drinks.map((drink) => (
    `<button class="drink-card ${drink.name === state.selectedDrink ? "selected" : ""}" type="button" data-drink="${escapeHtml(drink.name)}">
      <strong>${escapeHtml(drink.name)}</strong>
      <span>${drink.count}곳 · 최저 ${formatWon(drink.minPrice)}</span>
    </button>`
  )).join("");

  els.drinkList.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedDrink = button.dataset.drink;
      state.activeCafeId = "";
      renderDrinkList();
      renderRankings();
      renderDetail();
    });
  });
}

function renderRankings() {
  const rankings = getRankings(state.selectedDrink);

  els.rankingTitle.textContent = state.selectedDrink ? `${state.selectedDrink} 최저가 랭킹` : "최저가 랭킹";
  els.rankingHelp.textContent = state.selectedDrink
    ? `${rankings.length}곳의 가격 정보를 낮은 순서로 정렬했습니다.`
    : "먹고 싶은 음료를 선택해주세요.";

  if (!state.selectedDrink) {
    els.rankingList.innerHTML = `<div class="empty">먹고 싶은 음료를 선택해주세요.</div>`;
    return;
  }

  if (!rankings.length) {
    els.rankingList.innerHTML = `<div class="empty">해당 음료 가격 정보가 없습니다.</div>`;
    return;
  }

  els.rankingList.innerHTML = rankings.map((row, index) => (
    `<article class="ranking-card ${index === 0 ? "winner" : ""}">
      <div class="rank-left">
        <span class="rank-badge">${index + 1}위</span>
        <div>
          <h3>${escapeHtml(row.cafeName)}</h3>
          <p class="drink-name">${escapeHtml(row.drinkName)}</p>
          <p>위치: ${escapeHtml(row.location)}</p>
          <p>거리: ${escapeHtml(row.distanceText)}</p>
          <div class="tags">${row.tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}</div>
          <p class="updated">최근 수정: ${escapeHtml(row.updatedAt || "확인 필요")}</p>
        </div>
      </div>
      <div class="rank-right">
        <strong>${formatWon(row.price)}</strong>
        <button class="button ghost" type="button" data-detail="${escapeHtml(row.cafeId)}">${state.activeCafeId === row.cafeId ? "접기" : "상세"}</button>
        <button class="button light" type="button" data-report="${escapeHtml(row.cafeId)}" data-menu="${escapeHtml(row.menuId)}">가격 제보</button>
      </div>
      ${state.activeCafeId === row.cafeId ? renderInlineDetail(row.cafeId) : ""}
    </article>`
  )).join("");

  els.rankingList.querySelectorAll("[data-detail]").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeCafeId = state.activeCafeId === button.dataset.detail ? "" : button.dataset.detail;
      renderRankings();
      renderDetail();
      if (state.activeCafeId) {
        document.querySelector(`[data-detail="${state.activeCafeId}"]`)?.closest(".ranking-card")?.scrollIntoView({
          behavior: "smooth",
          block: "nearest"
        });
      }
    });
  });

  els.rankingList.querySelectorAll("[data-report]").forEach((button) => {
    const cafe = state.cafes[button.dataset.report];
    const menu = cafe?.menus?.[button.dataset.menu];
    button.addEventListener("click", () => openReport(cafe, menu));
  });

  els.rankingList.querySelectorAll("[data-inline-report-cafe]").forEach((button) => {
    const cafe = state.cafes[button.dataset.inlineReportCafe];
    const menu = cafe?.menus?.[button.dataset.inlineReportMenu];
    button.addEventListener("click", () => openReport(cafe, menu));
  });
}

function renderInlineDetail(cafeId) {
  const cafe = state.cafes[cafeId];
  if (!cafe) {
    return "";
  }

  const menus = getDisplayMenusForCafe(cafe).sort((a, b) => a.name.localeCompare(b.name, "ko-KR"));
  return `
    <div class="inline-detail">
      <div>
        <strong>${escapeHtml(cafe.name)} 전체 메뉴</strong>
        <p>${escapeHtml(cafe.location)} · ${escapeHtml(cafe.hours)}</p>
      </div>
      <div class="inline-menu-list">
        ${menus.map((menu) => `
          <div class="inline-menu-row">
            <span>${escapeHtml(menu.name)}</span>
            <span>${escapeHtml(menu.category)}</span>
            <strong>${formatWon(menu.price)}</strong>
            <button class="button light" type="button" data-inline-report-cafe="${escapeHtml(cafeId)}" data-inline-report-menu="${escapeHtml(menu.id)}">가격 제보</button>
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

function renderDetail() {
  const cafe = state.cafes[state.activeCafeId];
  if (!cafe) {
    els.detailPanel.hidden = true;
    els.detailPanel.innerHTML = "";
    return;
  }

  const menus = getDisplayMenusForCafe(cafe).sort((a, b) => a.name.localeCompare(b.name, "ko-KR"));
  els.detailPanel.hidden = false;
  els.detailPanel.innerHTML = `
    <div class="section-heading">
      <h2>${escapeHtml(cafe.name)}</h2>
      <p>${escapeHtml(cafe.location)} · ${escapeHtml(cafe.hours)}</p>
    </div>
    <div class="tags">${(cafe.tags || []).map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}</div>
    <div class="menu-table">
      ${menus.map((menu) => `
        <div class="menu-row">
          <span>${escapeHtml(menu.name)}</span>
          <span>${escapeHtml(menu.category)}</span>
          <strong>${formatWon(menu.price)}</strong>
          <button class="button light" type="button" data-menu-report="${escapeHtml(menu.id)}">가격 제보</button>
        </div>
      `).join("")}
    </div>
  `;

  els.detailPanel.querySelectorAll("[data-menu-report]").forEach((button) => {
    const menu = cafe.menus[button.dataset.menuReport];
    button.addEventListener("click", () => openReport(cafe, menu));
  });
}

function showAdminView(show) {
  if (show && !state.firebaseReady) {
    showStatus("관리자 기능과 가격 제보 저장은 Firebase Web config 입력 후 사용할 수 있습니다. firebase-config.js에 apiKey와 appId를 넣어주세요.");
  }
  els.userView.hidden = show;
  els.adminView.hidden = !show;
  els.adminToggle.hidden = show;
  renderAdminTools();
}

async function loginAdmin(event) {
  event.preventDefault();
  if (!state.firebaseReady) {
    showStatus("Firebase 설정 후 관리자 로그인을 사용할 수 있습니다.");
    return;
  }

  try {
    await fb.signInWithEmailAndPassword(fb.auth, els.adminEmail.value, els.adminPassword.value);
  } catch (error) {
    showStatus(`로그인 실패: ${error.message}`);
  }
}

async function logoutAdmin() {
  if (state.firebaseReady) {
    await fb.signOut(fb.auth);
  }
}

function renderAdminTools() {
  const loggedIn = state.firebaseReady && state.adminUser && state.isAdmin;
  els.loginForm.hidden = loggedIn;
  els.adminTools.hidden = !loggedIn;

  if (!loggedIn) {
    return;
  }

  const cafes = toCafeList(state.cafes);
  if (!state.selectedAdminCafeId && cafes.length) {
    state.selectedAdminCafeId = cafes[0].id;
  }

  els.adminCafeSelect.innerHTML = cafes.map((cafe) => (
    `<option value="${escapeHtml(cafe.id)}" ${cafe.id === state.selectedAdminCafeId ? "selected" : ""}>${escapeHtml(cafe.name)}</option>`
  )).join("");

  renderCafeForm();
  renderMenuForm();
  renderReports();
}

function renderCafeForm() {
  const cafe = state.cafes[state.selectedAdminCafeId] || {};
  els.cafeForm.innerHTML = `
    <div class="form-grid">
      <label><span>카페명</span><input name="name" value="${escapeAttr(cafe.name || "")}" required /></label>
      <label><span>위치</span><input name="location" value="${escapeAttr(cafe.location || "")}" required /></label>
      <label><span>거리 문구</span><input name="distanceText" value="${escapeAttr(cafe.distanceText || "")}" required /></label>
      <label><span>거리(m)</span><input name="distanceMeters" type="number" min="0" value="${escapeAttr(cafe.distanceMeters ?? "")}" /></label>
      <label><span>영업시간</span><input name="hours" value="${escapeAttr(cafe.hours || "영업시간 확인 필요")}" required /></label>
      <label><span>태그</span><input name="tags" value="${escapeAttr((cafe.tags || []).join(", "))}" /></label>
    </div>
    <div class="actions">
      <button class="button primary" type="submit">카페 수정</button>
      <button class="button light" type="button" id="addCafeButton">카페 추가</button>
      <button class="button danger" type="button" id="deleteCafeButton">카페 삭제</button>
    </div>
  `;

  document.getElementById("addCafeButton").addEventListener("click", addCafe);
  document.getElementById("deleteCafeButton").addEventListener("click", deleteCafe);
}

async function saveCafe(event) {
  event.preventDefault();
  const form = new FormData(els.cafeForm);
  const cafe = state.cafes[state.selectedAdminCafeId] || {};
  const payload = cafePayload(form, cafe.menus || {});
  await writeCafe(state.selectedAdminCafeId, payload);
}

async function addCafe() {
  const form = new FormData(els.cafeForm);
  const name = String(form.get("name") || "").trim();
  if (!name) {
    showStatus("새 카페명을 입력해주세요.");
    return;
  }

  const cafeId = `cafe_${Date.now()}`;
  await writeCafe(cafeId, cafePayload(form, {}));
  state.selectedAdminCafeId = cafeId;
}

async function deleteCafe() {
  if (!state.selectedAdminCafeId || !confirm("선택한 카페를 삭제할까요?")) {
    return;
  }

  await fb.remove(fb.ref(fb.db, `cafes/${state.selectedAdminCafeId}`));
  state.selectedAdminCafeId = "";
}

function cafePayload(form, menus) {
  const distanceMeters = Number(form.get("distanceMeters"));
  return {
    name: String(form.get("name") || "").trim(),
    location: String(form.get("location") || "").trim(),
    distanceText: String(form.get("distanceText") || "").trim(),
    ...(Number.isFinite(distanceMeters) ? { distanceMeters } : {}),
    hours: String(form.get("hours") || "").trim(),
    tags: String(form.get("tags") || "")
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean),
    menus
  };
}

async function writeCafe(cafeId, payload) {
  await fb.set(fb.ref(fb.db, `cafes/${cafeId}`), payload);
  showStatus("카페 정보가 저장되었습니다.");
}

function renderMenuForm() {
  const cafe = state.cafes[state.selectedAdminCafeId];
  const menu = cafe?.menus?.[state.selectedAdminMenuId] || {};
  els.menuForm.innerHTML = `
    <div class="form-grid">
      <label><span>메뉴명</span><input name="name" value="${escapeAttr(menu.name || "")}" required /></label>
      <label><span>카테고리</span><select name="category">${CATEGORIES.filter((c) => c !== "전체").map((category) => (
        `<option value="${escapeAttr(category)}" ${category === menu.category ? "selected" : ""}>${escapeHtml(category)}</option>`
      )).join("")}</select></label>
      <label><span>가격</span><input name="price" type="number" min="0" value="${escapeAttr(menu.price ?? "")}" required /></label>
    </div>
    <button class="button primary" type="submit">${state.selectedAdminMenuId ? "메뉴 수정" : "메뉴 추가"}</button>
  `;

  const menus = toMenuList(cafe?.menus || {}).sort((a, b) => a.name.localeCompare(b.name, "ko-KR"));
  els.adminMenuList.innerHTML = menus.map((item) => `
    <div class="admin-row">
      <span>${escapeHtml(item.name)}</span>
      <span>${formatWon(item.price)}</span>
      <button class="button ghost" type="button" data-edit-menu="${escapeHtml(item.id)}">수정</button>
      <button class="button danger" type="button" data-delete-menu="${escapeHtml(item.id)}">삭제</button>
    </div>
  `).join("");

  els.adminMenuList.querySelectorAll("[data-edit-menu]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedAdminMenuId = button.dataset.editMenu;
      renderMenuForm();
    });
  });

  els.adminMenuList.querySelectorAll("[data-delete-menu]").forEach((button) => {
    button.addEventListener("click", async () => {
      if (confirm("메뉴를 삭제할까요?")) {
        await fb.remove(fb.ref(fb.db, `cafes/${state.selectedAdminCafeId}/menus/${button.dataset.deleteMenu}`));
      }
    });
  });
}

async function saveMenu(event) {
  event.preventDefault();
  const form = new FormData(els.menuForm);
  const menuId = state.selectedAdminMenuId || `menu_${Date.now()}`;
  const price = Number(form.get("price"));
  await fb.set(fb.ref(fb.db, `cafes/${state.selectedAdminCafeId}/menus/${menuId}`), {
    name: String(form.get("name") || "").trim(),
    category: String(form.get("category") || "커피"),
    price,
    updatedAt: today()
  });
  state.selectedAdminMenuId = "";
}

function renderReports() {
  if (!els.reportList) {
    return;
  }

  const reports = Object.entries(state.reports || {});
  els.reportList.innerHTML = reports.length
    ? reports.map(([id, report]) => `
      <article class="report-card">
        <strong>${escapeHtml(report.cafeName)} · ${escapeHtml(report.drinkName)}</strong>
        <p>${formatWon(report.oldPrice)} → ${formatWon(report.newPrice)}</p>
        <p>${escapeHtml(report.memo || "제보 내용 없음")}</p>
        <button class="button danger" type="button" data-delete-report="${escapeHtml(id)}">삭제</button>
      </article>
    `).join("")
    : `<div class="empty small">아직 가격 제보가 없습니다.</div>`;

  els.reportList.querySelectorAll("[data-delete-report]").forEach((button) => {
    button.addEventListener("click", async () => {
      await fb.remove(fb.ref(fb.db, `reports/${button.dataset.deleteReport}`));
    });
  });
}

function openReport(cafe, menu) {
  if (!cafe || !menu) {
    return;
  }

  els.reportCafeName.value = cafe.name;
  els.reportDrinkName.value = menu.name;
  els.reportOldPrice.value = menu.price;
  els.reportNewPrice.value = "";
  els.reportMemo.value = "";
  els.reportMessage.textContent = "";
  els.reportDialog.showModal();
}

async function submitReport(event) {
  event.preventDefault();
  els.reportMessage.textContent = "";

  if (!state.firebaseReady) {
    els.reportMessage.textContent = "Firebase 설정 후 제보를 저장할 수 있습니다.";
    return;
  }

  try {
    await fb.push(fb.ref(fb.db, "reports"), {
      cafeName: els.reportCafeName.value.trim(),
      drinkName: els.reportDrinkName.value.trim(),
      oldPrice: Number(els.reportOldPrice.value),
      newPrice: Number(els.reportNewPrice.value),
      memo: els.reportMemo.value.trim(),
      createdAt: new Date().toISOString()
    });
    els.reportMessage.textContent = "가격 제보가 저장되었습니다.";
    setTimeout(() => els.reportDialog.close(), 700);
  } catch (error) {
    els.reportMessage.textContent = `저장 실패: ${error.message}`;
  }
}

function getDrinkSummaries() {
  const map = new Map();

  toCafeList(state.cafes).forEach((cafe) => {
    getDisplayMenusForCafe(cafe).forEach((menu) => {
      if (!menu.name || typeof menu.price !== "number") {
        return;
      }

      const current = map.get(menu.name) || {
        name: menu.name,
        category: menu.category,
        count: 0,
        minPrice: menu.price
      };
      current.count += 1;
      current.minPrice = Math.min(current.minPrice, menu.price);
      map.set(menu.name, current);
    });
  });

  return Array.from(map.values()).sort((a, b) => {
    if (a.category !== b.category) {
      return String(a.category).localeCompare(String(b.category), "ko-KR");
    }
    if (a.minPrice !== b.minPrice) {
      return a.minPrice - b.minPrice;
    }
    return a.name.localeCompare(b.name, "ko-KR");
  });
}

function getRankings(selectedDrink) {
  if (!selectedDrink) {
    return [];
  }

  const rows = [];

  toCafeList(state.cafes).forEach((cafe) => {
    getDisplayMenusForCafe(cafe).forEach((menu) => {
      if (menu.name !== selectedDrink || typeof menu.price !== "number") {
        return;
      }

      rows.push({
        cafeId: cafe.id,
        cafeName: cafe.name,
        location: cafe.location,
        distanceText: cafe.distanceText,
        distanceMeters: cafe.distanceMeters,
        tags: cafe.tags || [],
        menuId: menu.id,
        drinkName: menu.name,
        price: menu.price,
        updatedAt: menu.updatedAt
      });
    });
  });

  return rows.sort((a, b) => {
    if (a.price !== b.price) {
      return a.price - b.price;
    }

    if (Number.isFinite(a.distanceMeters) && Number.isFinite(b.distanceMeters)) {
      return a.distanceMeters - b.distanceMeters;
    }

    return 0;
  });
}

function getDisplayMenusForCafe(cafe) {
  const merged = new Map();

  toMenuList(cafe.menus).forEach((menu) => {
    const normalized = normalizeMenu(menu);
    const previous = merged.get(normalized.name);

    if (!previous || shouldUseMenu(previous, normalized)) {
      merged.set(normalized.name, normalized);
    }
  });

  return Array.from(merged.values());
}

function normalizeMenu(menu) {
  const name = MENU_ALIASES[menu.name] || menu.name;
  return {
    ...menu,
    rawName: menu.name,
    name,
    category: CANONICAL_CATEGORIES[name] || menu.category
  };
}

function shouldUseMenu(previous, next) {
  const previousIsRepresentative = previous.rawName === previous.name;
  const nextIsRepresentative = next.rawName === next.name;

  if (!previousIsRepresentative && nextIsRepresentative) {
    return true;
  }

  if (previousIsRepresentative && !nextIsRepresentative) {
    return false;
  }

  return false;
}

function toCafeList(cafes) {
  return Object.entries(cafes || {}).map(([id, cafe]) => ({ id, ...cafe }));
}

function toMenuList(menus) {
  return Object.entries(menus || {}).map(([id, menu]) => ({ id, ...menu }));
}

function normalize(value) {
  return String(value || "").toLowerCase().replace(/\s+/g, "");
}

function formatWon(value) {
  return typeof value === "number" && Number.isFinite(value)
    ? `${value.toLocaleString("ko-KR")}원`
    : "가격 확인 필요";
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function showStatus(message) {
  els.statusMessage.hidden = false;
  els.statusMessage.textContent = message;
}

function hideStatus() {
  els.statusMessage.hidden = true;
  els.statusMessage.textContent = "";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}
