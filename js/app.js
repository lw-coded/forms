(function () {
  "use strict";
  const $ = s => document.querySelector(s);
  const E = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const CODE = "LEAD1", FORM = window.SAMPLE_LEADERSHIP;
  const LS = { g(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }, s(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} } };
  const LK = ["Strongly agree", "Agree", "Disagree", "Strongly disagree"], LKIMG = ["strongly-agree", "agree", "disagree", "strongly-disagree"];
  const SUB = { likert: "Select how much you agree with the statement.", rank: "Rank all four responses, from most appropriate (1) to least appropriate (4)." };
  const ICON = {
    arrowR: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    arrowL: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 4.5 4.5L19 7"/></svg>',
    sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
    moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z"/></svg>',
    tool: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L4 17l3 3 5.3-5.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z"/></svg>'
  };
  const ART = '<svg class="art" viewBox="0 0 220 160" aria-hidden="true"><defs><linearGradient id="m1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d6dfff"/><stop offset="1" stop-color="#8ea5ff"/></linearGradient><linearGradient id="m2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9fe0bd"/><stop offset="1" stop-color="#5cbf8f"/></linearGradient></defs><circle cx="158" cy="34" r="14" fill="#ffd36e"/><ellipse cx="46" cy="64" rx="26" ry="9" fill="#fff" opacity=".8"/><ellipse cx="190" cy="78" rx="22" ry="8" fill="#fff" opacity=".8"/><path d="M96 150 156 66l54 84z" fill="#b6c4ff"/><path d="M28 150 100 40l72 110z" fill="url(#m1)"/><path d="M100 40l-14 22 14-6 10 8z" fill="#fff" opacity=".85"/><path d="M0 150q50-46 112 0z" fill="url(#m2)"/><path d="M120 150q40-34 100 0z" fill="#7fd0a4"/><path d="M100 40V16" stroke="#6b7088" stroke-width="2"/><path d="M100 16l17 6-17 7z" fill="#ff9d6c"/></svg>';

  const S = { view: "home", cur: 0, ans: {}, err: "", busy: false, sent: "" };
  const disp = t => String(t || "").replace(/^\s*\d+[.)]\s*/, "");
  const ot = o => typeof o === "string" ? o : o.t;
  const badge = n => `<span class="nb n${(n - 1) % 4}">${n}</span>`;
  const steps = f => { const s = []; f.questions.forEach(q => { const n = q.sec || "Questions"; if (!s.includes(n)) s.push(n); }); if (f.profiles) s.push("Results"); return s; };
  function qnum(f, q) { let n = 0; for (const x of f.questions) { if (x.type === "info") continue; if ((x.sec || "") === (q.sec || "")) n++; if (x === q) return n; } return 0; }

  /* Part A: 12 agree/disagree items (internal items score high when agreed with; external items are reverse coded).
     Part B: direction of each scenario's top-ranked response. */
  function calc(f, A) {
    let a = 0, i = 0, o = 0, n = 0, m = 0;
    f.questions.forEach(q => {
      const v = A[q.id];
      if (q.type === "likert" && v) { m++; a += q.dir === "in" ? 4 - v : v - 1; }
      if (q.type === "rank" && v && v.length) { n++; q.options[v[0]].d === "in" ? i++ : o++; }
    });
    return { a, m, i, o, n, bA: a >= 27 ? "in" : a >= 13 ? "bal" : "out", bB: i > 5 ? "in" : o > 5 ? "out" : "bal" };
  }

  function applyTheme(t) { document.documentElement.dataset.theme = t; LS.s("mt_theme", t); $("#theme").innerHTML = t === "dark" ? ICON.sun : ICON.moon; }
  $("#theme").onclick = () => applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
  $("#home").onclick = () => go("home");
  document.querySelectorAll(".nl[data-v]").forEach(b => b.onclick = () => go(b.dataset.v));
  function go(v) {
    S.view = v; S.err = ""; S.busy = false;
    if (v === "home" || v === "build") history.replaceState(null, "", location.href.split("#")[0]);
    render(); scrollTo(0, 0);
  }
  function render() {
    document.querySelectorAll(".nl[data-v]").forEach(b => b.classList.toggle("on", b.dataset.v === S.view || (b.dataset.v === "home" && ["take", "done"].includes(S.view))));
    ({ home: rHome, build: rBuild, take: rTake, done: rDone })[S.view]($("#app"));
  }
  function openCode(raw) {
    const c = String(raw || "").trim().toUpperCase();
    if (!c) { S.err = "Enter your form code."; return render(); }
    if (c !== CODE) { S.err = "No form matches that code. Check the code and try again."; return render(); }
    S.cur = 0; S.ans = {}; S.sent = ""; history.replaceState(null, "", "#/" + CODE); go("take");
  }

  function rHome(a) {
    a.innerHTML = `<section class="c hero"><h1>Enter your code</h1><p class="mute">Input your provided form code</p>
      <div class="cb g"><input id="ci" maxlength="10" placeholder="AB12C" autocomplete="off" autocapitalize="characters" spellcheck="false" aria-label="Form code"><button class="btn" id="go">Continue</button></div>
      <div class="err" role="alert">${E(S.err)}</div>
      <div class="how">${[["Enter your code", "Use the code shared by the research team."], ["Complete the form", "Answer each question at your own pace."], ["See your results", "A short summary of your style appears at the end."]].map((x, i) => `<div class="panel g">${badge(i + 1)}<h3>${x[0]}</h3><p class="mute sm" style="margin-top:4px">${x[1]}</p></div>`).join("")}</div></section>`;
    $("#go").onclick = () => openCode($("#ci").value);
    $("#ci").addEventListener("keydown", e => { if (e.key === "Enter") openCode(e.target.value); });
    $("#ci").focus();
  }
  function rBuild(a) {
    a.innerHTML = `<section class="soon"><div class="nb n0">${ICON.tool}</div><h1 style="font-size:34px">Form builder</h1><p class="mute">Building and editing forms is a work in progress. For now this site runs a single form, which you open with its code.</p><div style="margin-top:26px"><button class="btn" id="b">Enter a code</button></div></section>`;
    $("#b").onclick = () => go("home");
  }

  function rTake(a) {
    const f = FORM, n = f.questions.length, q = f.questions[S.cur], v = S.ans[q.id], last = S.cur === n - 1, info = q.type === "info";
    const st = steps(f), si = st.indexOf(q.sec || "Questions"), pct = Math.round(S.cur / n * 100);
    let body = "", ok = true;
    if (info) body = `<div class="body">${(q.body || "").split("\n").filter(Boolean).map(p => `<p>${E(p)}</p>`).join("")}</div>`;
    else if (q.type === "likert") { ok = v !== undefined; body = `<div class="lkt" role="radiogroup">${LK.map((l, i) => `<button class="${v === i + 1 ? "sel" : ""}" data-i="${i + 1}" role="radio" aria-checked="${v === i + 1}"><span class="av"><img src="assets/${LKIMG[i]}.webp" alt=""></span><span>${l}</span></button>`).join("")}</div>`; }
    else { const r = v || []; ok = r.length === q.options.length; body = `<div class="scn">${E(q.text)}</div><div class="opts">${q.options.map((o, i) => { const k = r.indexOf(i); return `<button class="opt ${k >= 0 ? "sel" : ""}" data-i="${i}"><span>${E(ot(o))}</span><span class="rk">${k >= 0 ? k + 1 : ""}</span></button>`; }).join("")}</div>${r.length ? '<button class="btn t b" id="rs" style="margin-top:12px">Reset ranking</button>' : ""}`; }
    const tag = `<span class="tag">${E(q.tag || q.sec || f.title)}</span>`;
    const head = info
      ? `${tag}<div class="hd"><div><h2>${E(disp(q.text))}</h2>${f.intro && S.cur === 0 ? `<p class="sub">${E(f.intro)}</p>` : ""}</div>${ART}</div>`
      : `${tag}<div class="qh">${badge(qnum(f, q))}<div><h2>${E(q.type === "rank" ? "What do you do?" : disp(q.text))}</h2><p class="sub">${SUB[q.type]}</p></div></div>`;
    a.innerHTML = `<div class="take"><div class="meta"><span>${S.cur + 1} of ${n}</span><div class="bar"><b style="width:${(S.cur + 1) / n * 100}%"></b></div></div>
      <section class="card g">${head}${body}
        <div class="ft"><button class="btn t" id="bk" ${S.cur ? "" : 'style="visibility:hidden"'}>${ICON.arrowL}Back</button><button class="btn" id="nx" ${ok ? "" : "disabled"}>${last ? "Submit" : "Next"}${last ? "" : ICON.arrowR}</button></div>
        <div class="err c" role="alert">${E(S.err)}</div></section>
      <aside class="pp g"><div class="ph"><h4>Your progress</h4><div class="bar"><b style="width:${pct}%"></b></div><span>${S.cur + 1} / ${n}</span></div>
        <div class="steps">${st.map((s, i) => `<div class="stp ${i < si ? "dn" : i === si ? "cu" : ""}"><i>${i < si ? ICON.check : i + 1}</i>${E(s)}</div>`).join("")}</div>
        <div class="pct"><b>${pct}% complete</b><span class="mute sm">${n - S.cur} of ${n} screens remaining</span><div class="bar"><b style="width:${pct}%"></b></div></div></aside></div>`;
    a.querySelectorAll("[data-i]").forEach(b => b.onclick = () => {
      const i = +b.dataset.i;
      if (q.type === "rank") { const r = (S.ans[q.id] || []).slice(), k = r.indexOf(i); k >= 0 ? r.splice(k, 1) : r.push(i); S.ans[q.id] = r; } else S.ans[q.id] = i;
      rTake(a);
    });
    const rs = $("#rs"); if (rs) rs.onclick = () => { S.ans[q.id] = []; rTake(a); };
    $("#bk").onclick = () => { S.cur--; rTake(a); };
    $("#nx").onclick = async () => { if (!last) { S.cur++; return rTake(a); } if (S.busy) return; S.busy = true; S.sent = await submit(); go("done"); };
  }

  /* Saves a copy on this device and, if an endpoint is set in js/config.js, sends the response there. */
  async function submit() {
    const f = FORM, r = calc(f, S.ans), P = f.profiles, L = String.fromCharCode;
    const out = { form: CODE, submitted: new Date().toISOString(), partA_score: r.a, partA_style: P[r.bA].n, partB_inner: r.i, partB_outer: r.o, partB_style: P[r.bB].n };
    let ai = 0, bi = 0;
    f.questions.forEach(q => { if (q.type === "likert") out["A" + (++ai)] = LK[S.ans[q.id] - 1]; if (q.type === "rank") out["B" + (++bi)] = (S.ans[q.id] || []).map(i => L(65 + i)).join(">"); });
    LS.s("mt_resp", (LS.g("mt_resp") || []).concat(out));
    const url = window.FORMS_CONFIG && window.FORMS_CONFIG.responseEndpoint;
    if (!url) return "none";
    try { const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(out) }); return res.ok ? "sent" : "failed"; }
    catch (e) { return "failed"; }
  }

  function rDone(a) {
    const f = FORM, P = f.profiles, r = calc(f, S.ans), p = P[r.bA], q = P[r.bB], pos = r.a / (r.m * 3 || 36) * 100;
    a.innerHTML = `<section class="card g res" style="grid-area:auto"><span class="tag">Your leadership response style</span><h1>${E(p.n)}</h1><p class="mute" style="margin-bottom:18px">${E(p.s)}</p><div class="body"><p>${E(p.t)}</p></div>
      <div class="cont"><i style="left:${Math.min(97, Math.max(3, 100 - pos))}%"></i></div><div class="cl"><span>Inner direction</span><span>Outer direction</span></div>
      <div class="two"><div class="panel g"><span class="mute sm">Part A, self-assessment</span><h3>${E(p.n)}</h3><p class="mute sm">Score ${r.a} of ${r.m * 3}</p></div><div class="panel g"><span class="mute sm">Part B, scenarios</span><h3>${E(q.n)}</h3><p class="mute sm">${r.i} inner and ${r.o} outer responses</p></div></div>
      <p class="mute sm" style="margin-top:18px">${r.bA === r.bB ? "Your self-assessment and scenario responses point to the same style." : "Your self-assessment and scenario responses differ. This is common: self-perception and context both shape how we respond."}</p>
      ${f.tip ? `<p class="mute" style="margin-top:14px"><b style="color:var(--ink);font-weight:550">Final tip.</b> ${E(f.tip)}</p>` : ""}
      ${S.sent === "sent" ? '<p class="mute sm" style="margin-top:14px">Your responses were submitted. Thank you.</p>' : S.sent === "failed" ? '<p class="err" style="min-height:0">Your results are shown, but your responses could not be sent. Check your connection.</p>' : ""}
      <div class="ft"><span></span><button class="btn" id="b">Done</button></div></section>`;
    $("#b").onclick = () => go("home");
  }

  applyTheme(LS.g("mt_theme") || "light");
  render();
  const m = location.hash.match(/^#\/([A-Za-z0-9]{3,10})$/); if (m) openCode(m[1]);
  window.addEventListener("hashchange", () => { const x = location.hash.match(/^#\/([A-Za-z0-9]{3,10})$/); if (x && S.view !== "take" && S.view !== "done") openCode(x[1]); });
})();
