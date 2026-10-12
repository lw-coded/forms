/* Storage layer. Two interchangeable back ends:
   - cloud: Firebase (Firestore + anonymous sign-in), shared between everyone who visits the site
   - local: this browser's localStorage, for demos and offline development
   Both expose the same methods, so the interface code does not care which one is running. */
(function () {
  const LS = {
    g(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
    s(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };

  function localStore() {
    let uid = LS.g("mt_uid");
    if (!uid) { uid = "u" + Math.random().toString(36).slice(2, 10); LS.s("mt_uid", uid); }
    const F = () => LS.g("mt_forms") || {}, R = () => LS.g("mt_resp") || {};
    return {
      mode: "local", uid,
      async getForm(c) { return F()[c] || null; },
      async createForm(c, d) { const m = F(); if (m[c]) throw new Error("exists"); m[c] = d; LS.s("mt_forms", m); },
      async saveForm(c, d) { const m = F(); m[c] = d; LS.s("mt_forms", m); },
      async deleteForm(c) { const m = F(); delete m[c]; LS.s("mt_forms", m); const r = R(); delete r[c]; LS.s("mt_resp", r); },
      async listMine() { return Object.entries(F()).filter(([, d]) => d.owner === uid).map(([code, d]) => ({ code, ...d })); },
      async addResponse(c, o) { const r = R(); (r[c] = r[c] || []).push(o); LS.s("mt_resp", r); },
      async getResponses(c) { return R()[c] || []; },
      watchResponses(c, cb) { const t = () => cb(R()[c] || []); t(); const id = setInterval(t, 2000); return () => clearInterval(id); },
      googleLinked: () => false
    };
  }

  async function cloudStore() {
    const B = "https://www.gstatic.com/firebasejs/10.12.2/";
    const [A, Au, Fs] = await Promise.all([import(B + "firebase-app.js"), import(B + "firebase-auth.js"), import(B + "firebase-firestore.js")]);
    const app = A.initializeApp(window.FORMS_CONFIG), auth = Au.getAuth(app), db = Fs.getFirestore(app);
    await new Promise(res => { const u = Au.onAuthStateChanged(auth, x => { u(); res(x); }); });
    if (!auth.currentUser) await Au.signInAnonymously(auth);
    const fref = c => Fs.doc(db, "forms", c), rcol = c => Fs.collection(db, "forms", c, "responses");
    return {
      mode: "cloud",
      get uid() { return auth.currentUser.uid; },
      async getForm(c) { const s = await Fs.getDoc(fref(c)); return s.exists() ? s.data() : null; },
      async createForm(c, d) { await Fs.setDoc(fref(c), d); },
      async saveForm(c, d) { await Fs.setDoc(fref(c), d); },
      async deleteForm(c) { const s = await Fs.getDocs(rcol(c)); await Promise.all(s.docs.map(x => Fs.deleteDoc(x.ref))); await Fs.deleteDoc(fref(c)); },
      async listMine() { const s = await Fs.getDocs(Fs.query(Fs.collection(db, "forms"), Fs.where("owner", "==", auth.currentUser.uid))); return s.docs.map(x => ({ code: x.id, ...x.data() })); },
      async addResponse(c, o) { await Fs.addDoc(rcol(c), o); },
      async getResponses(c) { const s = await Fs.getDocs(rcol(c)); return s.docs.map(x => x.data()); },
      watchResponses(c, cb) { return Fs.onSnapshot(rcol(c), s => cb(s.docs.map(x => x.data())), () => cb([])); },
      googleLinked: () => auth.currentUser.providerData.some(p => p.providerId === "google.com"),
      async googleSignIn() {
        const p = new Au.GoogleAuthProvider();
        try { await Au.linkWithPopup(auth.currentUser, p); }
        catch (e) { if (e.code === "auth/credential-already-in-use") await Au.signInWithCredential(auth, Au.GoogleAuthProvider.credentialFromError(e)); else throw e; }
      }
    };
  }
  window.Store = { LS, local: localStore, cloud: cloudStore };
})();
