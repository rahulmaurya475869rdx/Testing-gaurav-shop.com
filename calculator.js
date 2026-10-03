/* =========================================================
   Sree Shiv Alankar Mandir — Live Price Calculator
   Draggable red FAB → opens calculator modal
   ========================================================= */
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);

  const FAB_POS_KEY = "ssam_calc_fab_pos_v2";
  const EDGE_MARGIN = 12;
  const DRAG_THRESHOLD = 6;

  const calcState = { metal: "gold", purityIndex: 0, weight: 10 };

  let fab = null;
  let pointerState = null;
  let justDragged = false;

  /* ---------------- helpers ---------------- */
  function escapeHtml(str){
    return String(str || "").replace(/[&<>"']/g, m => ({
      "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
    }[m]));
  }
  function fmt(n){
    return "₹" + Math.round(n).toLocaleString("en-IN");
  }
  function waLink(number, text){
    const clean = (number || "").replace(/\D/g, "");
    const msg = encodeURIComponent(text || "");
    return clean ? `https://wa.me/${clean}?text=${msg}` : "#";
  }
  function getPricing(){
    const s = window.currentSettingsGlobal || {};
    return s.pricing || null;
  }
  function getCategory(){
    const p = getPricing();
    if (!p) return null;
    const metalData = p[calcState.metal];
    if (!metalData || !metalData.categories || !metalData.categories.length) return null;
    return metalData.categories[calcState.purityIndex] || metalData.categories[0];
  }

  /* ---------------- FAB size & position ---------------- */
  function fabSize(){
    if (!fab) return { w: 56, h: 52 };
    return { w: fab.offsetWidth || 56, h: fab.offsetHeight || 52 };
  }
  function loadFabPos(){
    try{
      const raw = localStorage.getItem(FAB_POS_KEY);
      if (!raw) return null;
      const p = JSON.parse(raw);
      if (typeof p.x !== "number" || typeof p.y !== "number") return null;
      return p;
    } catch(e){ return null; }
  }
  function saveFabPos(x, y){
    try{ localStorage.setItem(FAB_POS_KEY, JSON.stringify({ x, y })); } catch(e){}
  }
  function clampFab(x, y){
    const { w, h } = fabSize();
    return {
      x: Math.max(EDGE_MARGIN, Math.min(window.innerWidth  - w - EDGE_MARGIN, x)),
      y: Math.max(EDGE_MARGIN, Math.min(window.innerHeight - h - EDGE_MARGIN, y))
    };
  }
  function placeFab(x, y){
    if (!fab) return;
    const c = clampFab(x, y);
    fab.style.left = c.x + "px";
    fab.style.top  = c.y + "px";
    fab.style.right = "auto";
    fab.style.bottom = "auto";
    return c;
  }
  function defaultFabPos(){
    const { h } = fabSize();
    return {
      x: EDGE_MARGIN + 4,
      y: window.innerHeight - h - 24
    };
  }

  function initFabDrag(){
    if (!fab) return;

    const saved = loadFabPos();
    if (saved) placeFab(saved.x, saved.y);
    else {
      const d = defaultFabPos();
      placeFab(d.x, d.y);
    }

    fab.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      const rect = fab.getBoundingClientRect();
      pointerState = {
        id: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        offsetX: e.clientX - rect.left,
        offsetY: e.clientY - rect.top,
        moved: false
      };
      justDragged = false;
      fab.classList.add("is-pressed");
    });

    document.addEventListener("pointermove", (e) => {
      if (!pointerState || e.pointerId !== pointerState.id) return;
      const dx = e.clientX - pointerState.startX;
      const dy = e.clientY - pointerState.startY;
      if (!pointerState.moved && Math.hypot(dx, dy) > DRAG_THRESHOLD){
        pointerState.moved = true;
        fab.classList.add("dragging");
      }
      if (pointerState.moved){
        placeFab(e.clientX - pointerState.offsetX, e.clientY - pointerState.offsetY);
      }
    });

    document.addEventListener("pointerup", (e) => {
      if (!pointerState || e.pointerId !== pointerState.id) return;
      const wasMoved = pointerState.moved;
      pointerState = null;
      fab.classList.remove("dragging", "is-pressed");
      if (wasMoved){
        const rect = fab.getBoundingClientRect();
        const c = clampFab(rect.left, rect.top);
        placeFab(c.x, c.y);
        saveFabPos(c.x, c.y);
        justDragged = true;
      }
    });

    document.addEventListener("pointercancel", () => {
      if (pointerState){
        pointerState = null;
        fab.classList.remove("dragging", "is-pressed");
      }
    });

    // Click → open modal (agar drag nahi hua)
    fab.addEventListener("click", (e) => {
      if (justDragged){
        justDragged = false;
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      openCalcModal();
    });

    window.addEventListener("resize", () => {
      const rect = fab.getBoundingClientRect();
      const c = clampFab(rect.left, rect.top);
      placeFab(c.x, c.y);
      saveFabPos(c.x, c.y);
    });
  }

  /* ---------------- Modal ---------------- */
  function openCalcModal(){
    const bd = $("calcModalBackdrop");
    if (!bd) return;
    refresh();
    bd.classList.add("open");
    document.body.style.overflow = "hidden";
  }
  function closeCalcModal(){
    const bd = $("calcModalBackdrop");
    if (!bd) return;
    bd.classList.remove("open");
    document.body.style.overflow = "";
  }

  /* ---------------- Render ---------------- */
  function renderMetalTabs(){
    document.querySelectorAll(".calc-metal-tab").forEach(tab => {
      tab.classList.toggle("active", tab.dataset.metal === calcState.metal);
    });
  }
  function renderPurityChips(){
    const wrap = $("calcPurityChips");
    if (!wrap) return;
    const p = getPricing();
    const metalData = p && p[calcState.metal];
    const cats = (metalData && metalData.categories) || [];
    if (!cats.length){
      wrap.innerHTML = '<p class="calc-empty" style="padding:0;">No purities set for this metal.</p>';
      return;
    }
    if (calcState.purityIndex >= cats.length) calcState.purityIndex = 0;
    wrap.innerHTML = cats.map((c, i) => `
      <button type="button" class="calc-purity-chip ${i === calcState.purityIndex ? "active" : ""}" data-i="${i}">
        ${escapeHtml(c.label || "—")}
      </button>
    `).join("");
    wrap.querySelectorAll(".calc-purity-chip").forEach(btn => {
      btn.onclick = () => {
        calcState.purityIndex = parseInt(btn.dataset.i, 10);
        renderPurityChips();
        renderBreakdown();
      };
    });
  }

  function renderBreakdown(){
    const wrap = $("calcBreakdown");
    const waBtn = $("calcWaBtn");
    if (!wrap) return;

    const p = getPricing();
    const metalData = p && p[calcState.metal];
    const cat = getCategory();
    const weight = parseFloat(calcState.weight) || 0;

    if (!cat || !cat.rate || cat.rate <= 0 || weight <= 0){
      wrap.innerHTML = `<p class="calc-empty">Rates abhi set nahi hue. WhatsApp par poochh lein.</p>`;
      if (waBtn){
        const s = window.currentSettingsGlobal || {};
        waBtn.href = waLink(s.whatsapp, "Hi! I'd like to know today's rates.");
      }
      return;
    }

    const metalValue = cat.rate * weight;
    const makingPct = parseFloat(cat.making) || 0;
    const makingAmt = makingPct > 0 ? (metalValue * makingPct / 100) : 0;
    const subtotal = metalValue + makingAmt;
    const gstPct = parseFloat(metalData.gst) || 0;
    const gstAmt = subtotal * gstPct / 100;
    const total = subtotal + gstAmt;

    const metalLabel = calcState.metal.charAt(0).toUpperCase() + calcState.metal.slice(1);

    let rows = `
      <div class="calc-row">
        <span>${escapeHtml(metalLabel)} ${escapeHtml(cat.label)} — ${weight}g × ${fmt(cat.rate)}/g</span>
        <strong>${fmt(metalValue)}</strong>
      </div>
    `;
    if (makingPct > 0){
      rows += `
        <div class="calc-row">
          <span>Making charges (${makingPct}%)</span>
          <strong>${fmt(makingAmt)}</strong>
        </div>
      `;
    }
    if (gstPct > 0){
      rows += `
        <div class="calc-row">
          <span>GST (${gstPct}%)</span>
          <strong>${fmt(gstAmt)}</strong>
        </div>
      `;
    }
    rows += `
      <div class="calc-row calc-total">
        <span>Approx. Total</span>
        <strong>${fmt(total)}</strong>
      </div>
    `;
    wrap.innerHTML = rows;

    if (waBtn){
      const s = window.currentSettingsGlobal || {};
      let msg = `Hi! I'd like to enquire about ${weight}g ${metalLabel} ${cat.label}.`;
      msg += `\nRate: ₹${cat.rate}/g`;
      msg += `\nMetal value: ₹${Math.round(metalValue).toLocaleString("en-IN")}`;
      if (makingPct > 0) msg += `\nMaking (${makingPct}%): ₹${Math.round(makingAmt).toLocaleString("en-IN")}`;
      if (gstPct > 0) msg += `\nGST (${gstPct}%): ₹${Math.round(gstAmt).toLocaleString("en-IN")}`;
      msg += `\nApprox total: ₹${Math.round(total).toLocaleString("en-IN")}`;
      waBtn.href = waLink(s.whatsapp, msg);
    }
  }

  function bindControls(){
    document.querySelectorAll(".calc-metal-tab").forEach(tab => {
      tab.onclick = () => {
        calcState.metal = tab.dataset.metal;
        calcState.purityIndex = 0;
        renderMetalTabs();
        renderPurityChips();
        renderBreakdown();
      };
    });

    const wInput = $("calcWeight");
    const wSlider = $("calcWeightSlider");

    if (wInput){
      wInput.oninput = () => {
        calcState.weight = parseFloat(wInput.value) || 0;
        if (wSlider) wSlider.value = Math.min(100, Math.max(1, calcState.weight));
        renderBreakdown();
      };
    }
    if (wSlider){
      wSlider.oninput = () => {
        calcState.weight = parseFloat(wSlider.value) || 0;
        if (wInput) wInput.value = calcState.weight;
        renderBreakdown();
      };
    }
    document.querySelectorAll(".calc-quick-btns button").forEach(btn => {
      btn.onclick = () => {
        calcState.weight = parseFloat(btn.dataset.w);
        if (wInput) wInput.value = calcState.weight;
        if (wSlider) wSlider.value = Math.min(100, calcState.weight);
        renderBreakdown();
      };
    });

    const closeBtn = $("calcModalClose");
    if (closeBtn) closeBtn.onclick = closeCalcModal;

    const bd = $("calcModalBackdrop");
    if (bd) {
      bd.addEventListener("click", (e) => {
        if (e.target === bd) closeCalcModal();
      });
    }

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeCalcModal();
    });
  }

  function refresh(){
    if (!fab) return;
    const p = getPricing();

    const hasGold   = p && p.gold   && p.gold.categories   && p.gold.categories.length;
    const hasSilver = p && p.silver && p.silver.categories && p.silver.categories.length;

    if (!hasGold && !hasSilver){
      fab.hidden = true;
      const bd = $("calcModalBackdrop");
      if (bd && bd.classList.contains("open")) closeCalcModal();
      return;
    }
    fab.hidden = false;

    const curr = p[calcState.metal] && p[calcState.metal].categories;
    if (!curr || !curr.length){
      calcState.metal = hasGold ? "gold" : "silver";
      calcState.purityIndex = 0;
    }
    if (calcState.purityIndex >= ((p[calcState.metal].categories || []).length)){
      calcState.purityIndex = 0;
    }

    renderMetalTabs();
    renderPurityChips();
    renderBreakdown();
  }

  function init(){
    fab = $("calcFab");
    if (!fab) return;
    bindControls();
    initFabDrag();
    if (window.currentSettingsGlobal) refresh();
  }

  if (document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window.refreshCalculator = refresh;
  window.openCalcModal = openCalcModal;
})();
