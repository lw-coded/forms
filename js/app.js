(function () {
  "use strict";
  const $ = s => document.querySelector(s);
  const E = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const LS = window.Store.LS;
  const AL = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const gen = () => Array.from({ length: 5 }, () => AL[Math.random() * AL.length | 0]).join("");
  const LK = ["Strongly agree", "Agree", "Disagree", "Strongly disagree"];
  const LKIMG = ["strongly-agree", "agree", "disagree", "strongly-disagree"];
  const TY = { choice: "Choice", scale: "Scale (1–5)", text: "Text", likert: "Agree / disagree", rank: "Ranking", info: "Info page" };
  const SUB = {
    likert: "Select how much you agree with the statement.",
    choice: "Select one response.",
    rank: "Rank all four responses, from most appropriate (1) to least appropriate (4).",
    scale: "Select a rating from 1 to 5.",
    text: "Write your response below."
  };
  const ICON = {
    arrowR: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    arrowL: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 4.5 4.5L19 7"/></svg>',
    sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
    moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z"/></svg>'
  };
  const ART = '<svg class="art" viewBox="0 0 220 160" aria-hidden="true"><defs><linearGradient id="m1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d6dfff"/><stop offset="1" stop-color="#8ea5ff"/></linearGradient><linearGradient id="m2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9fe0bd"/><stop offset="1" stop-color="#5cbf8f"/></linearGradient></defs><circle cx="158" cy="34" r="14" fill="#ffd36e"/><ellipse cx="46" cy="64" rx="26" ry="9" fill="#fff" opacity=".8"/><ellipse cx="190" cy="78" rx="22" ry="8" fill="#fff" opacity=".8"/><path d="M96 150 156 66l54 84z" fill="#b6c4ff"/><path d="M28 150 100 40l72 110z" fill="url(#m1)"/><path d="M100 40l-14 22 14-6 10 8z" fill="#fff" opacity=".85"/><path d="M0 150q50-46 112 0z" fill="url(#m2)"/><path d="M120 150q40-34 100 0z" fill="#7fd0a4"/><path d="M100 40V16" stroke="#6b7088" stroke-width="2"/><path d="M100 16l17 6-17 7z" fill="#ff9d6c"/></svg>';

  const S = { view: "home", form: null, code: "", cur: 0, ans: {}, mine: null, err: "", msg: "", resp: null, busy: false, preview: false, newOpen: false, fatal: "" };
  let ST = null, unsub = null;

  /* ---------- helpers ---------- */
  const disp = t => String(t || "").replace(/^\s*\d+[.)]\s*/, "");
  const ot = o => typeof o === "string" ? o : o.t;
  const opt = (...a) => a.filter(Boolean).join(" ");
  const shareLink = c => location.href.split("#")[0] + "#/" + c;
  const steps = f => { const s = []; f.questions.forEach(q => { const n = q.sec || "Questions"; if (!s.includes(n)) s.push(n); }); if (f.profiles) s.push("Results"); return s; };
  function qnum(f, q) { let n = 0; for (const x of f.questions) { if (x.type === "info") continue; if ((x.sec || "") === (q.sec || "")) n++; if (x === q) return n; } return 0; }
  const badge = (n, small) => `<span class="nb n${(n - 1) % 4}${small ? " sm" : ""}">${n}</span>`;
  const demo = () => ST && ST.mode === "local" ? `<div class="note">Demo mode: forms and responses are stored only in this browser. Add your Firebase settings in js/config.js to share with other people.</div>` : "";
  const recent = () => LS.g("mt_recent") || [];
  function addRecent(code, title) { const r = recent().filter(x => x.code !== code); r.unshift({ code, title }); LS.s("mt_recent", r.slice(0, 12)); }
  const isOwner = () => ST && S.form && S.form.owner === ST.uid;

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

  /* ---------- theme and navigation ---------- */
  function applyTheme(t) { document.documentElement.dataset.theme = t; LS.s("mt_theme", t); $("#theme").innerHTML = t === "dark" ? ICON.sun : ICON.moon; }
  $("#theme").onclick = () => applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
  $("#home").onclick = () => go("home");
  document.querySelectorAll(".nl[data-v]").forEach(b => b.onclick = () => go(b.dataset.v));
  function stopWatch() { if (unsub) { unsub(); unsub = null; } }
  function go(v) {
    stopWatch(); S.view = v; S.err = ""; S.msg = ""; S.busy = false;
    if (v === "home" || v === "mine") history.replaceState(null, "", location.href.split("#")[0]);
    if (v === "mine") loadMine();
    render(); scrollTo(0, 0);
  }
  function render() {
    document.querySelectorAll(".nl[data-v]").forEach(b => { const v = b.dataset.v; b.classList.toggle("on", v === S.view || (v === "mine" && ["build", "stats"].includes(S.view)) || (v === "home" && ["take", "done"].includes(S.view))); });
    const a = $("#app");
    if (S.fatal) { a.innerHTML = `<section class="c hero"><h1>Can't connect</h1><p class="mute">${E(S.fatal)}</p></section>`; return; }
    ({ home: rHome, mine: rMine, take: rTake, done: rDone, build: rBuild, stats: rStats })[S.view](a);
  }

  /* ---------- data actions ---------- */
  async function openCode(raw) {
    const c = String(raw || "").trim().toUpperCase();
    if (!c) { S.err = "Enter your form code."; return render(); }
    if (!ST) { S.err = "Still connecting. Try again in a moment."; return render(); }
    try {
      const d = await ST.getForm(c);
      if (!d) { S.err = "No form matches that code. Check the code and try again."; return render(); }
      S.code = c; S.form = JSON.parse(d.json); S.form.owner = d.owner; S.cur = 0; S.ans = {}; S.preview = false;
      addRecent(c, S.form.title);
      history.replaceState(null, "", "#/" + c);
      go("take");
    } catch (e) { S.err = "That form could not be opened."; render(); }
  }
  async function loadMine() { try { S.mine = await ST.listMine(); } catch (e) { S.mine = []; } if (S.view === "mine") render(); }
  async function createForm(kind) {
    let c, i = 0;
    do { c = gen(); i++; } while (await ST.getForm(c) && i < 8);
    const body = kind === "leadership" ? JSON.parse(JSON.stringify(window.SAMPLE_LEADERSHIP))
      : { title: "Untitled form", intro: "", questions: [{ id: "q" + Date.now().toString(36), type: "choice", sec: "Questions", text: "Question", options: ["Option A", "Option B"] }] };
    try {
      await ST.createForm(c, { owner: ST.uid, title: body.title, json: JSON.stringify(body), updated: Date.now() });
      S.code = c; S.form = { ...body, owner: ST.uid }; S.newOpen = false; go("build");
    } catch (e) { S.err = "Could not create the form: " + (e.message || e); render(); }
  }
  async function saveForm() {
    const { owner, ...body } = S.form;
    try { await ST.saveForm(S.code, { owner: ST.uid, title: body.title, json: JSON.stringify(body), updated: Date.now() }); S.msg = "Saved. Participants will see the latest version."; }
    catch (e) { S.msg = "Could not save: " + (e.message || "no access"); }
    render();
  }
  async function deleteForm() { if (!confirm("Delete this form and all of its responses?")) return; try { await ST.deleteForm(S.code); } catch (e) {} go("mine"); }
  async function loadOwned(c) { const d = await ST.getForm(c); S.code = c; S.form = JSON.parse(d.json); S.form.owner = d.owner; }
  function startWatch() {
    stopWatch(); S.resp = null;
    unsub = ST.watchResponses(S.code, rs => { S.resp = rs.map(x => { try { return { at: x.at, a: JSON.parse(x.answers) }; } catch (e) { return { at: x.at, a: {} }; } }); if (S.view === "stats") render(); });
  }

  /* ---------- pages ---------- */
  function rHome(a) {
    a.innerHTML = `<section class="c hero">${demo()}<h1>Enter your code</h1><p class="mute">Input your provided form code</p>
      <div class="cb g"><input id="ci" maxlength="10" placeholder="AB12C" autocomplete="off" autocapitalize="characters" spellcheck="false" aria-label="Form code"><button class="btn" id="go">Continue</button></div>
      <div class="err" role="alert">${E(S.err)}</div>
      <div class="how">${[["Enter your code", "Use the code shared by the research team."], ["Complete the form", "Answer each question at your own pace."], ["See your results", "Some forms show a short summary at the end."]].map((x, i) => `<div class="panel g">${badge(i + 1)}<h3>${x[0]}</h3><p class="mute sm" style="margin-top:4px">${x[1]}</p></div>`).join("")}</div></section>`;
    $("#go").onclick = () => openCode($("#ci").value);
    $("#ci").addEventListener("keydown", e => { if (e.key === "Enter") openCode(e.target.value); });
    $("#ci").focus();
  }

  function rMine(a) {
    const m = S.mine, rec = recent();
    a.innerHTML = `${demo()}<div class="top"><h1 style="font-size:34px">My forms</h1><button class="btn" id="nf">New form</button></div>
      ${S.err ? `<div class="err">${E(S.err)}</div>` : ""}
      ${S.newOpen ? `<div class="new"><button class="panel g" data-k="blank"><h3>Blank form</h3><span class="mute">Start from one question.</span></button><button class="panel g" data-k="leadership"><h3>Global Leadership Challenge</h3><span class="mute">A copy of the sample form with its scoring.</span></button></div>` : ""}
      <h3 style="margin:8px 0 12px">Created by you</h3>
      ${m === null ? '<p class="mute">Loading…</p>' : m.length ? m.map(f => `<div class="panel g li"><div><h3>${E(f.title)}</h3><span class="code">${f.code}</span></div><div class="acts"><button class="btn b" data-s="${f.code}">Responses</button><button class="btn b s" data-e="${f.code}">Edit</button><button class="btn b s" data-o="${f.code}">Open</button></div></div>`).join("") : '<div class="panel g c"><p class="mute">You have not created a form yet. Choose New form to start.</p></div>'}
      ${rec.length ? `<h3 style="margin:28px 0 12px">Opened with a code</h3>${rec.map(f => `<div class="panel g li"><div><h3>${E(f.title)}</h3><span class="code">${f.code}</span></div><div class="acts"><button class="btn b s" data-o="${f.code}">Open</button><button class="btn b t" data-rm="${f.code}">Remove</button></div></div>`).join("")}<p class="mute sm">This list is saved only in this browser.</p>` : ""}
      ${ST && ST.mode === "cloud" ? `<p class="mute sm" style="margin-top:28px">Your forms are tied to this browser. ${ST.googleLinked() ? "Your Google account is linked, so you can sign in on other devices." : '<button class="btn b s" id="gs" style="margin-left:6px">Sign in with Google</button> to keep access across devices.'}</p>` : ""}`;
    $("#nf").onclick = () => { S.newOpen = !S.newOpen; render(); };
    a.querySelectorAll("[data-k]").forEach(b => b.onclick = () => createForm(b.dataset.k));
    a.querySelectorAll("[data-e]").forEach(b => b.onclick = async () => { await loadOwned(b.dataset.e); go("build"); });
    a.querySelectorAll("[data-s]").forEach(b => b.onclick = async () => { await loadOwned(b.dataset.s); go("stats"); startWatch(); });
    a.querySelectorAll("[data-o]").forEach(b => b.onclick = () => openCode(b.dataset.o));
    a.querySelectorAll("[data-rm]").forEach(b => b.onclick = () => { LS.s("mt_recent", recent().filter(x => x.code !== b.dataset.rm)); render(); });
    const gs = $("#gs"); if (gs) gs.onclick = async () => { try { await ST.googleSignIn(); S.mine = null; loadMine(); } catch (e) { S.err = "Google sign-in is not set up: " + (e.message || e); render(); } };
  }

  function rTake(a) {
    const f = S.form, n = f.questions.length, q = f.questions[S.cur], v = S.ans[q.id], last = S.cur === n - 1, info = q.type === "info";
    const st = steps(f), si = st.indexOf(q.sec || "Questions"), pct = Math.round(S.cur / n * 100);
    let body = "", ok = true;
    if (info) body = `<div class="body">${(q.body || "").split("\n").filter(Boolean).map(p => `<p>${E(p)}</p>`).join("")}</div>`;
    else if (q.type === "choice") { ok = v !== undefined; body = `<div class="opts" role="radiogroup">${q.options.map((o, i) => `<button class="opt ${v === i ? "sel" : ""}" role="radio" aria-checked="${v === i}" data-i="${i}">${E(ot(o))}<span class="rd"></span></button>`).join("")}</div>`; }
    else if (q.type === "likert") { ok = v !== undefined; body = `<div class="lkt" role="radiogroup">${LK.map((l, i) => `<button class="${v === i + 1 ? "sel" : ""}" data-i="${i + 1}" role="radio" aria-checked="${v === i + 1}"><span class="av"><img src="assets/${LKIMG[i]}.webp" alt=""></span><span>${l}</span></button>`).join("")}</div>`; }
    else if (q.type === "rank") { const r = v || []; ok = r.length === q.options.length; body = `<div class="scn">${E(q.text)}</div><div class="opts">${q.options.map((o, i) => { const k = r.indexOf(i); return `<button class="opt ${k >= 0 ? "sel" : ""}" data-i="${i}"><span>${E(ot(o))}</span><span class="rk">${k >= 0 ? k + 1 : ""}</span></button>`; }).join("")}</div>${r.length ? '<button class="btn t b" id="rs" style="margin-top:12px">Reset ranking</button>' : ""}`; }
    else if (q.type === "scale") { ok = v !== undefined; body = `<div class="sc">${[1, 2, 3, 4, 5].map(i => `<button class="${v === i ? "sel" : ""}" data-i="${i}">${i}</button>`).join("")}</div><div class="sl"><span>${E(q.options[0] || "Low")}</span><span>${E(q.options[1] || "High")}</span></div>`; }
    else body = `<textarea id="tx" rows="6" placeholder="Your response">${E(v || "")}</textarea>`;
    const tag = `<span class="tag">${E(q.tag || q.sec || f.title)}</span>`;
    const head = info
      ? `${tag}<div class="hd"><div><h2>${E(disp(q.text))}</h2>${f.intro && S.cur === 0 ? `<p class="sub">${E(f.intro)}</p>` : ""}</div>${ART}</div>`
      : `${tag}<div class="qh">${badge(qnum(f, q))}<div><h2>${E(q.type === "rank" ? "What do you do?" : disp(q.text))}</h2><p class="sub">${SUB[q.type]}</p></div></div>`;
    a.innerHTML = `${S.preview ? '<div class="note">Preview. Responses are not saved.</div>' : demo()}
      <div class="take"><div class="meta"><span>${S.cur + 1} of ${n}</span><div class="bar"><b style="width:${(S.cur + 1) / n * 100}%"></b></div></div>
      <section class="card g">${head}${body}
        <div class="ft"><button class="btn t" id="bk" ${S.cur ? "" : 'style="visibility:hidden"'}>${ICON.arrowL}Back</button><button class="btn" id="nx" ${ok ? "" : "disabled"}>${last ? (S.preview ? "Finish preview" : "Submit") : "Next"}${last ? "" : ICON.arrowR}</button></div>
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
    const tx = $("#tx"); if (tx) tx.oninput = () => S.ans[q.id] = tx.value;
    $("#bk").onclick = () => { S.cur--; S.err = ""; rTake(a); };
    $("#nx").onclick = async () => {
      S.err = "";
      if (!last) { S.cur++; return rTake(a); }
      if (S.preview) return go("build");
      if (S.busy) return; S.busy = true;
      try { await ST.addResponse(S.code, { answers: JSON.stringify(S.ans), at: Date.now() }); go("done"); }
      catch (e) { S.busy = false; S.err = "Your response could not be submitted. Check your connection and try again."; rTake(a); }
    };
  }

  function rDone(a) {
    const f = S.form, P = f.profiles;
    if (!P) { a.innerHTML = `<section class="c hero"><h1>Thank you</h1><p class="mute" style="margin-bottom:32px">Your response to “${E(f.title)}” has been recorded.</p><button class="btn" id="b">Done</button></section>`; return $("#b").onclick = () => go("home"); }
    const r = calc(f, S.ans), p = P[r.bA], q = P[r.bB], pos = r.a / (r.m * 3 || 36) * 100;
    a.innerHTML = `<section class="card g res" style="grid-area:auto"><span class="tag">Your leadership response style</span><h1>${E(p.n)}</h1><p class="mute" style="margin-bottom:18px">${E(p.s)}</p><div class="body"><p>${E(p.t)}</p></div>
      <div class="cont"><i style="left:${Math.min(97, Math.max(3, 100 - pos))}%"></i></div><div class="cl"><span>Inner direction</span><span>Outer direction</span></div>
      <div class="two"><div class="panel g"><span class="mute sm">Part A, self-assessment</span><h3>${E(p.n)}</h3><p class="mute sm">Score ${r.a} of ${r.m * 3}</p></div><div class="panel g"><span class="mute sm">Part B, scenarios</span><h3>${E(q.n)}</h3><p class="mute sm">${r.i} inner and ${r.o} outer responses</p></div></div>
      <p class="mute sm" style="margin-top:18px">${r.bA === r.bB ? "Your self-assessment and scenario responses point to the same style." : "Your self-assessment and scenario responses differ. This is common: self-perception and context both shape how we respond."}</p>
      ${f.tip ? `<p class="mute" style="margin-top:14px"><b style="color:var(--ink);font-weight:550">Final tip.</b> ${E(f.tip)}</p>` : ""}
      <div class="ft"><span></span><button class="btn" id="b">Done</button></div></section>`;
    $("#b").onclick = () => go("home");
  }

  function noAccess(a) { a.innerHTML = `<section class="c hero"><h1>No access</h1><p class="mute">Only the person who created this form can edit it or view its responses.</p><div style="margin-top:24px"><button class="btn" id="b">Back to My forms</button></div></section>`; $("#b").onclick = () => go("mine"); }

  function rBuild(a) {
    if (!isOwner()) return noAccess(a);
    const f = S.form, Q = f.questions;
    const fresh = t => ({ choice: ["Option A", "Option B"], scale: ["Low", "High"], text: [], info: [], likert: [], rank: ["A", "B", "C", "D"].map(x => ({ t: "Option " + x, d: "in" })) })[t];
    a.innerHTML = `${demo()}<div class="top"><div><span class="code">Form code</span><h1 style="font-size:34px;letter-spacing:.08em">${S.code}</h1></div><div class="acts"><button class="btn s" id="bk">Back</button><button class="btn" id="sv">Save changes</button></div></div>
      ${S.msg ? `<p class="mute" style="margin-bottom:12px">${E(S.msg)}</p>` : ""}
      <label class="l" style="margin-top:0">Share link</label><div class="share"><input class="f" id="lk" readonly value="${E(shareLink(S.code))}"><button class="btn s b" id="cp">Copy link</button></div>
      <label class="l">Title</label><input class="f" id="t" value="${E(f.title)}"><label class="l">Description</label><textarea id="d" rows="2">${E(f.intro)}</textarea><label class="l">Questions</label>
      ${Q.map((q, i) => `<div class="panel g"><div class="row" style="margin:0"><select data-ty="${i}" style="width:150px;flex:none">${Object.entries(TY).map(([k, l]) => `<option value="${k}" ${q.type === k ? "selected" : ""}>${l}</option>`).join("")}</select><input class="f qt" data-q="${i}" value="${E(q.text)}"><button class="x" data-up="${i}" aria-label="Move up">↑</button><button class="x" data-dn="${i}" aria-label="Move down">↓</button><button class="x" data-del="${i}" aria-label="Delete question">✕</button></div>
        <div class="row"><span>Section</span><input class="f qs" data-q="${i}" value="${E(q.sec || "")}" placeholder="Shown in the progress list"></div>
        ${q.type === "info" ? `<textarea class="qb" data-q="${i}" rows="4" style="margin-top:8px" placeholder="Page text">${E(q.body || "")}</textarea>` : ""}
        ${q.type === "likert" ? `<div class="row"><span>Item type</span><select class="qd" data-q="${i}"><option value="in" ${q.dir === "in" ? "selected" : ""}>Internal item</option><option value="out" ${q.dir === "out" ? "selected" : ""}>External item (reverse coded)</option></select></div>` : ""}
        ${q.type === "choice" || q.type === "rank" ? q.options.map((o, j) => `<div class="row"><span>${String.fromCharCode(65 + j)}</span><input class="f ot" data-q="${i}" data-o="${j}" value="${E(ot(o))}">${q.type === "rank" ? `<select class="od" data-q="${i}" data-o="${j}" style="width:110px;flex:none"><option value="in" ${o.d === "in" ? "selected" : ""}>Inner</option><option value="out" ${o.d === "out" ? "selected" : ""}>Outer</option></select>` : ""}<button class="x" data-do="${i}.${j}" aria-label="Remove option">✕</button></div>`).join("") + `<button class="btn t b" style="margin-top:8px" data-ao="${i}">Add option</button>` : ""}
        ${q.type === "scale" ? `<div class="row"><span>1 =</span><input class="f ot" data-q="${i}" data-o="0" value="${E(q.options[0] || "")}"></div><div class="row"><span>5 =</span><input class="f ot" data-q="${i}" data-o="1" value="${E(q.options[1] || "")}"></div>` : ""}</div>`).join("")}
      <button class="btn s b" id="aq">Add question</button>
      <div class="acts" style="margin-top:36px"><button class="btn t" id="pv">Preview</button><button class="btn t" id="rs">View responses</button><button class="btn t dg" id="dl">Delete form</button></div>`;
    const sync = () => {
      f.title = $("#t").value; f.intro = $("#d").value;
      a.querySelectorAll(".qt").forEach(e => Q[+e.dataset.q].text = e.value);
      a.querySelectorAll(".qs").forEach(e => Q[+e.dataset.q].sec = e.value);
      a.querySelectorAll(".qb").forEach(e => Q[+e.dataset.q].body = e.value);
      a.querySelectorAll(".qd").forEach(e => Q[+e.dataset.q].dir = e.value);
      a.querySelectorAll(".ot").forEach(e => { const q = Q[+e.dataset.q], j = +e.dataset.o; q.type === "rank" ? q.options[j].t = e.value : q.options[j] = e.value; });
      a.querySelectorAll(".od").forEach(e => Q[+e.dataset.q].options[+e.dataset.o].d = e.value);
    };
    const act = (s, fn) => a.querySelectorAll(s).forEach(b => b.onclick = () => { sync(); fn(b); S.msg = ""; rBuild(a); });
    act("[data-del]", b => Q.length > 1 && Q.splice(+b.dataset.del, 1));
    act("[data-up]", b => { const i = +b.dataset.up; if (i) [Q[i - 1], Q[i]] = [Q[i], Q[i - 1]]; });
    act("[data-dn]", b => { const i = +b.dataset.dn; if (i < Q.length - 1) [Q[i + 1], Q[i]] = [Q[i], Q[i + 1]]; });
    act("[data-ao]", b => { const q = Q[+b.dataset.ao]; q.options.push(q.type === "rank" ? { t: "Option", d: "in" } : "Option"); });
    act("[data-do]", b => { const [i, j] = b.dataset.do.split(".").map(Number); if (Q[i].options.length > 2) Q[i].options.splice(j, 1); });
    $("#aq").onclick = () => { sync(); Q.push({ id: "q" + Date.now().toString(36), type: "choice", sec: Q.length ? Q[Q.length - 1].sec : "Questions", text: "Question", options: fresh("choice") }); S.msg = ""; rBuild(a); };
    a.querySelectorAll("[data-ty]").forEach(s => s.onchange = () => { sync(); const q = Q[+s.dataset.ty]; q.type = s.value; q.options = fresh(s.value); if (s.value === "likert") q.dir = "in"; rBuild(a); });
    $("#cp").onclick = async () => { try { await navigator.clipboard.writeText($("#lk").value); $("#cp").textContent = "Copied"; } catch (e) { $("#lk").select(); } };
    $("#sv").onclick = () => { sync(); saveForm(); };
    $("#bk").onclick = () => go("mine");
    $("#pv").onclick = () => { sync(); S.cur = 0; S.ans = {}; S.preview = true; go("take"); };
    $("#rs").onclick = () => { sync(); go("stats"); startWatch(); };
    $("#dl").onclick = deleteForm;
  }

  function rStats(a) {
    if (!isOwner()) return noAccess(a);
    const f = S.form, R = S.resp;
    if (!R) { a.innerHTML = `<p class="mute c">Loading responses…</p>`; return; }
    const n = R.length, last = n ? new Date(Math.max(...R.map(r => r.at || 0))).toLocaleDateString() : "None yet", P = f.profiles;
    const bar = (l, c, t) => { const p = t ? c / t * 100 : 0; return `<div class="ar"><span>${E(l)}</span><div class="t"><i style="width:${p}%"></i></div><em>${c} (${p.toFixed(0)}%)</em></div>`; };
    let prof = "";
    if (P && n) {
      const rs = R.map(r => calc(f, r.a));
      prof = `<div class="panel g"><h3>Response styles</h3><p class="mute sm" style="margin:4px 0 12px">Part A self-assessment compared with Part B scenarios</p>${["in", "bal", "out"].map(k => bar(P[k].n + " (A)", rs.filter(x => x.bA === k).length, n) + bar(P[k].n + " (B)", rs.filter(x => x.bB === k).length, n)).join("")}<p class="mute sm" style="margin-top:12px">Matching styles: ${rs.filter(x => x.bA === x.bB).length} of ${n}. Mean Part A score: ${(rs.reduce((s, x) => s + x.a, 0) / n).toFixed(1)}.</p></div>`;
    }
    const Qs = f.questions.filter(q => q.type !== "info");
    a.innerHTML = `${demo()}<div class="top"><div><span class="code">${S.code}</span><h1 style="font-size:34px">${E(f.title)}<span class="live"><i></i>Live</span></h1></div><div class="acts"><button class="btn s" id="ed">Edit form</button><button class="btn" id="csv" ${n ? "" : "disabled"}>Export CSV</button></div></div>
      <div class="kp"><div class="panel g"><b>${n}</b><span class="mute sm">Responses</span></div><div class="panel g"><b>${Qs.length}</b><span class="mute sm">Questions</span></div><div class="panel g"><b>${last}</b><span class="mute sm">Latest response</span></div></div>${prof}
      ${n ? "" : `<p class="mute c" style="margin-top:28px">No responses yet. Share code ${S.code}. This page updates by itself.</p>`}
      ${Qs.map((q, i) => {
        const vs = R.map(r => r.a[q.id]).filter(v => v !== undefined && v !== "" && !(Array.isArray(v) && !v.length));
        let h = `<div class="panel g"><div class="qs">${badge(qnum(f, q), true)}<h3>${E(q.type === "rank" ? (q.tag || "Scenario") : disp(q.text))}</h3></div><p class="mute sm" style="margin:0 0 10px 42px">${vs.length} responses${q.type === "rank" ? ", first choices shown" : ""}</p>`;
        if (q.type === "choice") h += q.options.map((o, j) => bar(ot(o), vs.filter(v => v === j).length, vs.length)).join("");
        else if (q.type === "rank") h += q.options.map((o, j) => bar(String.fromCharCode(65 + j) + ". " + ot(o).slice(0, 28), vs.filter(v => v[0] === j).length, vs.length)).join("");
        else if (q.type === "likert") h += LK.map((l, j) => bar(l, vs.filter(v => v === j + 1).length, vs.length)).join("");
        else if (q.type === "scale") { h += [1, 2, 3, 4, 5].map(k => bar(String(k), vs.filter(v => v === k).length, vs.length)).join(""); if (vs.length) h += `<p class="mute sm" style="margin-top:12px">Mean ${(vs.reduce((s, x) => s + x, 0) / vs.length).toFixed(2)}</p>`; }
        else h += vs.slice(-20).reverse().map(t => `<div class="tx">${E(t)}</div>`).join("");
        return h + "</div>";
      }).join("")}`;
    $("#ed").onclick = () => go("build");
    $("#csv").onclick = () => {
      const c = v => `"${String(v ?? "").replace(/"/g, '""')}"`, L = String.fromCharCode;
      const fm = (x, v) => v === undefined ? "" : x.type === "choice" ? ot(x.options[v]) : x.type === "likert" ? LK[v - 1] : x.type === "rank" ? v.map(i => L(65 + i)).join(">") : v;
      const rows = R.map(r => [new Date(r.at).toISOString(), ...Qs.map(x => fm(x, r.a[x.id]))].map(c).join(","));
      const csv = [["submitted", ...Qs.map(x => disp(x.text))].map(c).join(","), ...rows].join("\n");
      const u = URL.createObjectURL(new Blob([csv], { type: "text/csv" })), l = document.createElement("a");
      l.href = u; l.download = S.code + "-responses.csv"; l.click(); setTimeout(() => URL.revokeObjectURL(u), 1000);
    };
  }

  /* ---------- start ---------- */
  async function boot() {
    applyTheme(LS.g("mt_theme") || "light");
    render();
    try { ST = window.FORMS_CONFIG ? await window.Store.cloud() : window.Store.local(); }
    catch (e) { S.fatal = "The form service could not be reached. " + (e.message || ""); }
    render();
    const route = () => { const m = location.hash.match(/^#\/([A-Za-z0-9]{3,10})$/); if (m && ST && !(["take", "done"].includes(S.view) && S.code === m[1].toUpperCase())) openCode(m[1]); };
    route(); window.addEventListener("hashchange", route);
  }
  boot();
})();
