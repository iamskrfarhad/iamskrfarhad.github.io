/* Bhara Koi! — login + cloud sync layer (web version).
 *
 * Same system as Hisab Koi!: email/password register & login (Firebase
 * Auth) and automatic backup of the whole local database to Firestore.
 * Same Firebase project (hisab-koi-9b48a) — the same account works in
 * all three apps — but Bhara Koi!'s data lives in its own fields of the
 * user's doc (bharaDb / bharaUpdatedAt), fully separate from Hisab
 * Koi!'s (db / updatedAt) and Rozgar's (rojgarDb / rojgarUpdatedAt).
 * The app itself is unchanged: it keeps working offline from
 * localStorage; this layer only mirrors the data to the cloud when a
 * user is logged in, and pulls it down on login on a new device.
 * If Firebase fails to load (offline), the app behaves as before.
 */
(function () {
  var cfg = {
    apiKey: "AIzaSyDK4TqIdKxEHE-vxNWeOBcowaKX9-cjYX4",
    authDomain: "hisab-koi-9b48a.firebaseapp.com",
    projectId: "hisab-koi-9b48a",
    storageBucket: "hisab-koi-9b48a.firebasestorage.app",
    messagingSenderId: "242764294362",
    appId: "1:242764294362:web:e1244d99bd3211dae0dde3"
  };
  if (typeof firebase === "undefined") return;

  var KEY = "bharaKoiDB_v1";
  var META = "bhara-cloud-meta";
  var SKIP = "bk-skip-auth";

  function savedDB() {
    try { return JSON.parse(window.localStorage.getItem(KEY) || "null"); } catch (e) { return null; }
  }
  function savedLang() {
    var d = savedDB();
    return d && d.lang === "en" ? "en" : "bn";
  }
  function savedTheme() {
    try { return window.localStorage.getItem("bkTheme") === "dark" ? "dark" : "light"; } catch (e) { return "light"; }
  }
  var lang = savedLang();
  var theme = savedTheme();

  var STR = {
    bn: {
      sub: "লগিন করলে আপনার ভাড়ার হিসাব সব ডিভাইসে অটোমেটিক পাবেন",
      tabLogin: "লগিন", tabReg: "রেজিস্টার",
      namePh: "আপনার নাম — যেমন: শাকিল রানা",
      mailPh: "ইমেইল",
      passPh: "পাসওয়ার্ড (কমপক্ষে ৬ অক্ষর)",
      goLogin: "লগিন করুন", goReg: "রেজিস্টার করুন",
      forgot: "পাসওয়ার্ড ভুলে গেছেন?",
      skip: "লগিন ছাড়া চালান — হিসাব শুধু এই ডিভাইসেই থাকবে",
      wait: "অপেক্ষা করুন…",
      syncing: "আপনার হিসাব লোড হচ্ছে…",
      syncingSub: "সার্ভার থেকে আপনার ভাড়ার হিসাব আনা হচ্ছে — একটু অপেক্ষা করুন। অ্যাপ খালি দেখালেও আপনার সব ডেটা নিরাপদে আছে।",
      needBoth: "ইমেইল আর পাসওয়ার্ড দিন।",
      needName: "আপনার নাম লিখুন।",
      needMailFirst: "আগে ইমেইলটা লিখুন, তারপর চাপুন।",
      resetSent: "পাসওয়ার্ড বদলানোর লিংক আপনার ইমেইলে পাঠানো হয়েছে।",
      remember: "আমাকে মনে রাখুন",
      loginBtn: "লগিন করুন",
      loginSub: "লগিন করলে হিসাব সব ডিভাইসে সিঙ্ক হবে",
      logout: "লগআউট"
    },
    en: {
      sub: "Log in to get your rent accounts automatically on every device",
      tabLogin: "Log in", tabReg: "Register",
      namePh: "Your name — e.g.: Shakil Rana",
      mailPh: "Email",
      passPh: "Password (at least 6 characters)",
      goLogin: "Log in", goReg: "Register",
      forgot: "Forgot password?",
      skip: "Continue without login — data stays on this device only",
      wait: "Please wait…",
      syncing: "Loading your accounts…",
      syncingSub: "Fetching your rent accounts from the server — please wait. Even if the app looks empty, all your data is safe.",
      needBoth: "Enter your email and password.",
      needName: "Please enter your name.",
      needMailFirst: "Enter your email first, then tap.",
      resetSent: "A password reset link has been sent to your email.",
      remember: "Remember me",
      loginBtn: "Log in",
      loginSub: "Log in to sync your accounts on every device",
      logout: "Log out"
    }
  };
  var ERRS = {
    bn: {
      "auth/invalid-email": "ইমেইলটা ঠিক নয় — আবার দেখুন।",
      "auth/user-not-found": "ইমেইল বা পাসওয়ার্ড মিলছে না।",
      "auth/wrong-password": "ইমেইল বা পাসওয়ার্ড মিলছে না।",
      "auth/invalid-credential": "ইমেইল বা পাসওয়ার্ড মিলছে না।",
      "auth/email-already-in-use": "এই ইমেইল দিয়ে আগেই অ্যাকাউন্ট আছে — লগিন করুন।",
      "auth/weak-password": "পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।",
      "auth/network-request-failed": "ইন্টারনেট সংযোগ পাওয়া যাচ্ছে না — আবার চেষ্টা করুন।",
      "auth/too-many-requests": "অনেকবার চেষ্টা হয়েছে — একটু পরে আবার চেষ্টা করুন।",
      "default": "কিছু সমস্যা হয়েছে — আবার চেষ্টা করুন।"
    },
    en: {
      "auth/invalid-email": "That email doesn't look right — please check it.",
      "auth/user-not-found": "Email or password doesn't match.",
      "auth/wrong-password": "Email or password doesn't match.",
      "auth/invalid-credential": "Email or password doesn't match.",
      "auth/email-already-in-use": "An account with this email already exists — please log in.",
      "auth/weak-password": "Password must be at least 6 characters.",
      "auth/network-request-failed": "No internet connection — please try again.",
      "auth/too-many-requests": "Too many attempts — please try again later.",
      "default": "Something went wrong — please try again."
    }
  };
  var THEMES = {
    light: {
      page: "linear-gradient(160deg,#013626 0%,#0d7a5f 55%,#0D9488 100%)",
      card: "background:#ffffff;border:1px solid transparent;",
      title: "#013626", sub: "#52796b",
      input: "border:1.5px solid #bfe3d6;background:#f2faf6;color:#013626;",
      tabOff: "background:#dcf2e8;color:#0b6e4f;",
      err: "#d92d20", ok: "#15803d",
      forgot: "#0D9488", skip: "#71857c",
      ctrl: "background:rgba(255,255,255,.92);color:#013626;border:1px solid rgba(255,255,255,.65);"
    },
    dark: {
      page: "linear-gradient(160deg,#02120c 0%,#06382a 55%,#04241c 100%)",
      card: "background:#0b2e23;border:1px solid #175c46;",
      title: "#ffffff", sub: "#9fd4c0",
      input: "border:1.5px solid #1d5c46;background:#07231a;color:#ffffff;",
      tabOff: "background:#123f31;color:#9fd4c0;",
      err: "#f87171", ok: "#7dd3a6",
      forgot: "#5eead4", skip: "#8fb8a8",
      ctrl: "background:rgba(4,30,22,.88);color:#cfefe2;border:1px solid #175c46;"
    }
  };
  var ACCENT = "#0D9488";
  var APPNAME = "ভাড়া কই !";

  var auth, fs, currentUser = null, pushTimer = null, applying = false;
  try {
    firebase.initializeApp(cfg);
    auth = firebase.auth();
    fs = firebase.firestore();
    auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(function () {});
  } catch (e) { return; }

  /* ---------------- cloud sync ---------------- */
  function localTs() {
    try {
      var m = JSON.parse(window.localStorage.getItem(META) || "null");
      return m && currentUser && m.uid === currentUser.uid ? (m.updatedAt || 0) : 0;
    } catch (e) { return 0; }
  }
  function setMeta(ts) {
    try { window.localStorage.setItem(META, JSON.stringify({ uid: currentUser.uid, updatedAt: ts })); } catch (e) {}
  }
  /* A fresh device always "has" a (seed) database in localStorage, so
   * emptiness is judged by content — no records in any collection. */
  function localIsEmpty() {
    var db = savedDB();
    if (!db) return true;
    var ks = ["buildings", "flats", "tenants", "bills", "expenses", "wallets", "savings", "loans", "complaints", "workers", "staff", "staffTx", "transfers"];
    for (var i = 0; i < ks.length; i++) { var a = db[ks[i]]; if (Array.isArray(a) && a.length) return false; }
    return true;
  }
  function cloudSet(json, ts) {
    return fs.collection("users").doc(currentUser.uid).set(
      { bharaDb: json, bharaUpdatedAt: ts, email: currentUser.email || "", name: currentUser.displayName || "" },
      { merge: true }
    );
  }
  function schedulePush() {
    if (!currentUser || applying) return;
    window.clearTimeout(pushTimer);
    pushTimer = window.setTimeout(function () {
      var json = window.localStorage.getItem(KEY);
      if (!json) return;
      var ts = Date.now();
      cloudSet(json, ts).then(function () { setMeta(ts); }).catch(function () {});
    }, 2500);
  }
  window.__bkPush = schedulePush;
  /* Mirror every app save to the cloud (debounced). */
  try {
    var origSave = window.save;
    if (typeof origSave === "function") {
      window.save = function () { var r = origSave.apply(this, arguments); schedulePush(); return r; };
    }
  } catch (e) {}
  function ownerSwitch(user) {
    try {
      var owner = window.localStorage.getItem("bk-owner");
      if (owner && owner !== user.uid) {
        if (window.sessionStorage.getItem("bk-owner-switched") === user.uid) { window.localStorage.setItem("bk-owner", user.uid); return false; }
        window.localStorage.removeItem(KEY);
        window.localStorage.removeItem(META);
        window.localStorage.setItem("bk-owner", user.uid);
        try { window.sessionStorage.removeItem("bk-applied"); } catch (e) {}
        window.sessionStorage.setItem("bk-owner-switched", user.uid);
        window.location.reload();
        return true;
      }
      if (owner !== user.uid) window.localStorage.setItem("bk-owner", user.uid);
    } catch (e) {}
    return false;
  }
  function syncOnLogin() {
    var ref = fs.collection("users").doc(currentUser.uid);
    var settled = false;
    var to = window.setTimeout(function () { if (!settled) { settled = true; hideSyncing(); } }, 10000);
    ref.get().then(function (snap) {
      if (settled) return; settled = true; window.clearTimeout(to);
      var local = window.localStorage.getItem(KEY);
      var d = snap.exists && snap.data ? snap.data() : null;
      if (d && d.bharaDb) {
        var cdb = d.bharaDb, cts = d.bharaUpdatedAt || 0;
        if (cdb === local) { setMeta(cts); hideSyncing(); return; }
        if (cts > localTs() || localIsEmpty()) {
          if (sessionStorage.getItem("bk-applied")) { hideSyncing(); return; }
          applying = true;
          try { window.localStorage.setItem(KEY, cdb); } catch (e) {}
          setMeta(cts);
          sessionStorage.setItem("bk-applied", "1");
          window.location.reload();
        } else if (local) {
          var ts = Date.now();
          cloudSet(local, ts).then(function () { setMeta(ts); }).catch(function () {});
          hideSyncing();
        } else { hideSyncing(); }
      } else if (local) {
        var ts2 = Date.now();
        cloudSet(local, ts2).then(function () { setMeta(ts2); }).catch(function () {});
        hideSyncing();
      } else { hideSyncing(); }
    }).catch(function () { if (!settled) { settled = true; window.clearTimeout(to); } hideSyncing(); });
  }

  /* ---------------- helpers ---------------- */
  function el(tag, css, text) {
    var n = document.createElement(tag);
    if (css) n.style.cssText = css;
    if (text != null) n.textContent = text;
    return n;
  }
  function errText(code) {
    var m = ERRS[lang] || ERRS.bn;
    return m[code] || m["default"];
  }
  function appSetLang(l) {
    try {
      if (typeof DB !== "undefined" && DB) {
        DB.lang = l;
        if (typeof save === "function") save();
        if (typeof setLang === "function") setLang();
        if (typeof render === "function") render();
      }
    } catch (e) {}
  }
  function appSetTheme(t) {
    try {
      window.localStorage.setItem("bkTheme", t);
      if (typeof applyTheme === "function") applyTheme();
    } catch (e) {}
  }

  /* ---------------- login overlay ---------------- */
  var overlay = null, R = null, mode = "login";
  function buildOverlay() {
    overlay = el("div", "position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;padding:18px;overflow:auto;font-family:inherit;");
    var ctrls = el("div", "position:absolute;top:14px;right:14px;display:flex;gap:8px;align-items:center;");
    var langBn = el("button", "", "বাংলা");
    var langEn = el("button", "", "EN");
    var langBox = el("div", "display:flex;border-radius:999px;overflow:hidden;");
    langBox.appendChild(langBn); langBox.appendChild(langEn);
    var themeBtn = el("button", "", "🌙");
    ctrls.appendChild(langBox); ctrls.appendChild(themeBtn);
    var card = el("div", "width:100%;max-width:380px;border-radius:24px;padding:26px 22px 22px;box-shadow:0 18px 50px rgba(1,30,20,.4);");
    var title = el("div", "text-align:center;font-size:27px;font-weight:800;letter-spacing:.2px;", APPNAME);
    var sub = el("div", "text-align:center;font-size:13px;margin:6px 0 16px;line-height:1.5;");
    var tabs = el("div", "display:flex;gap:8px;margin-bottom:16px;");
    var tabLogin = el("button", "");
    var tabReg = el("button", "");
    tabs.appendChild(tabLogin); tabs.appendChild(tabReg);
    var nameIn = el("input", ""); nameIn.type = "text"; nameIn.autocomplete = "name";
    var mailIn = el("input", ""); mailIn.type = "email"; mailIn.autocomplete = "email";
    var passIn = el("input", ""); passIn.type = "password"; passIn.autocomplete = "current-password";
    var passWrap = el("div", "position:relative;");
    var eye = el("button", "position:absolute;right:8px;top:10px;background:none;border:0;font-size:17px;line-height:1;padding:4px;cursor:pointer;");
    eye.type = "button";
    eye.textContent = "🙈";
    passWrap.appendChild(passIn); passWrap.appendChild(eye);
    var remRow = el("label", "display:flex;align-items:center;gap:8px;font-size:14px;margin:0 0 8px;cursor:pointer;");
    var remIn = el("input", "width:17px;height:17px;accent-color:#0D9488;margin:0;"); remIn.type = "checkbox"; remIn.checked = true;
    var remTxt = el("span", "");
    remRow.appendChild(remIn); remRow.appendChild(remTxt);
    var msg = el("div", "min-height:20px;font-size:13px;margin:2px 0 8px;");
    var goBtn = el("button", "width:100%;padding:13px;border:0;border-radius:12px;background:#0D9488;color:#fff;font-size:16px;font-weight:800;cursor:pointer;");
    var forgot = el("button", "display:block;margin:12px auto 0;background:none;border:0;font-size:13px;cursor:pointer;font-weight:600;");
    var skip = el("button", "display:block;margin:14px auto 0;background:none;border:0;font-size:13px;cursor:pointer;text-decoration:underline;");
    card.appendChild(title); card.appendChild(sub);
    card.appendChild(tabs);
    card.appendChild(nameIn); card.appendChild(mailIn); card.appendChild(passWrap); card.appendChild(remRow);
    card.appendChild(msg); card.appendChild(goBtn); card.appendChild(forgot); card.appendChild(skip);
    overlay.appendChild(ctrls); overlay.appendChild(card);
    R = { overlay: overlay, card: card, title: title, sub: sub,
          tabLogin: tabLogin, tabReg: tabReg, nameIn: nameIn, mailIn: mailIn, passIn: passIn, eye: eye, remIn: remIn, remTxt: remTxt,
          msg: msg, goBtn: goBtn, forgot: forgot, skip: skip,
          langBn: langBn, langEn: langEn, langBox: langBox, themeBtn: themeBtn };
    tabLogin.onclick = function () { mode = "login"; paint(); };
    tabReg.onclick = function () { mode = "register"; paint(); };
    langBn.onclick = function () { setLangUi("bn"); };
    langEn.onclick = function () { setLangUi("en"); };
    themeBtn.onclick = function () { theme = theme === "dark" ? "light" : "dark"; appSetTheme(theme); paint(); };
    eye.onclick = function () {
      var show = passIn.type === "password";
      passIn.type = show ? "text" : "password";
      eye.textContent = show ? "👀" : "🙈";
    };
    goBtn.onclick = function () {
      var S = STR[lang];
      var email = mailIn.value.trim(), pass = passIn.value;
      if (!email || !pass) { msg.style.color = THEMES[theme].err; msg.textContent = S.needBoth; return; }
      goBtn.disabled = true; goBtn.textContent = S.wait; msg.textContent = "";
      var done = function () { goBtn.disabled = false; paint(); };
      var proceed = function () {
        if (mode === "register") {
          var nm = nameIn.value.trim();
          if (!nm) { msg.style.color = THEMES[theme].err; msg.textContent = S.needName; done(); return; }
          auth.createUserWithEmailAndPassword(email, pass)
            .then(function (cred) { return cred.user.updateProfile({ displayName: nm }); })
            .then(function () { done(); })
            .catch(function (e) { msg.style.color = THEMES[theme].err; msg.textContent = errText(e && e.code); done(); });
        } else {
          auth.signInWithEmailAndPassword(email, pass)
            .then(function () { done(); })
            .catch(function (e) { msg.style.color = THEMES[theme].err; msg.textContent = errText(e && e.code); done(); });
        }
      };
      try {
        var pers = remIn.checked ? firebase.auth.Auth.Persistence.LOCAL : firebase.auth.Auth.Persistence.SESSION;
        auth.setPersistence(pers).then(proceed, proceed);
      } catch (e) { proceed(); }
    };
    forgot.onclick = function () {
      var S = STR[lang];
      var email = mailIn.value.trim();
      if (!email) { msg.style.color = THEMES[theme].err; msg.textContent = S.needMailFirst; return; }
      auth.sendPasswordResetEmail(email).then(function () {
        msg.style.color = THEMES[theme].ok; msg.textContent = S.resetSent;
      }).catch(function (e) { msg.style.color = THEMES[theme].err; msg.textContent = errText(e && e.code); });
    };
    skip.onclick = function () {
      try { sessionStorage.setItem(SKIP, "1"); } catch (e) {}
      hideOverlay();
    };
    paint();
  }
  function setLangUi(l) {
    lang = l;
    appSetLang(l);
    paint();
  }
  function paint() {
    if (!R) return;
    var S = STR[lang], P = THEMES[theme];
    R.overlay.style.background = P.page;
    R.card.style.cssText = "width:100%;max-width:380px;border-radius:24px;padding:26px 22px 22px;box-shadow:0 18px 50px rgba(1,30,20,.4);" + P.card;
    R.title.style.color = P.title;
    R.sub.style.color = P.sub;
    R.sub.textContent = S.sub;
    var INP = "width:100%;box-sizing:border-box;padding:12px 14px;margin:0 0 10px;border-radius:12px;font-size:16px;outline:none;text-align:left;" + P.input;
    R.nameIn.style.cssText = INP; R.mailIn.style.cssText = INP;
    R.passIn.style.cssText = INP.replace("padding:12px 14px", "padding:12px 46px 12px 14px");
    R.eye.style.color = P.sub;
    R.remTxt.textContent = S.remember;
    R.remTxt.style.color = P.sub;
    R.nameIn.placeholder = S.namePh; R.mailIn.placeholder = S.mailPh; R.passIn.placeholder = S.passPh;
    function tabCss(active) {
      return "flex:1;padding:10px;border-radius:12px;border:0;font-size:15px;font-weight:700;cursor:pointer;" +
        (active ? "background:" + ACCENT + ";color:#fff;" : P.tabOff);
    }
    R.tabLogin.style.cssText = tabCss(mode === "login");
    R.tabReg.style.cssText = tabCss(mode === "register");
    R.tabLogin.textContent = S.tabLogin;
    R.tabReg.textContent = S.tabReg;
    R.nameIn.style.display = mode === "register" ? "block" : "none";
    R.goBtn.textContent = mode === "register" ? S.goReg : S.goLogin;
    R.forgot.style.display = mode === "register" ? "none" : "block";
    R.forgot.style.color = P.forgot;
    R.forgot.textContent = S.forgot;
    R.skip.style.color = P.skip;
    R.skip.textContent = S.skip;
    if (!R.msg.textContent) R.msg.style.color = P.err;
    var ctrlBtn = "padding:7px 12px;border:0;font-size:13px;font-weight:700;cursor:pointer;";
    R.langBox.style.cssText = "display:flex;border-radius:999px;overflow:hidden;" + P.ctrl;
    R.langBn.style.cssText = ctrlBtn + (lang === "bn" ? "background:" + ACCENT + ";color:#fff;" : "background:transparent;color:inherit;");
    R.langEn.style.cssText = ctrlBtn + (lang === "en" ? "background:" + ACCENT + ";color:#fff;" : "background:transparent;color:inherit;");
    R.themeBtn.style.cssText = "width:34px;height:34px;border-radius:999px;font-size:15px;cursor:pointer;display:flex;align-items:center;justify-content:center;" + P.ctrl;
    R.themeBtn.textContent = theme === "dark" ? "☀️" : "🌙";
  }
  function showOverlay() {
    if (!document.body) { document.addEventListener("DOMContentLoaded", showOverlay); return; }
    if (!overlay) buildOverlay();
    if (!overlay.parentNode) document.body.appendChild(overlay);
    overlay.style.display = "flex";
    paint();
    if (!showOverlay._warm) { showOverlay._warm = 1; try { fs.collection("users").doc("ping").get().then(function () {}, function () {}); } catch (e) {} }
  }
  function hideOverlay() { if (overlay) overlay.style.display = "none"; }

  /* ---------------- syncing overlay ---------------- */
  var syncOv = null, syncTO = null;
  function showSyncing() {
    if (!document.body) return;
    if (!syncOv) {
      syncOv = el("div", "position:fixed;inset:0;z-index:99998;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:24px;text-align:center;");
      syncOv.id = "bk-syncing";
      if (!document.getElementById("bk-splash-css")) { var sc = document.createElement("style"); sc.id = "bk-splash-css"; sc.textContent = "@keyframes bkFloat{0%,100%{transform:translateY(0) scale(1)}50%{transform:translateY(-10px) scale(1.04)}}"; document.head.appendChild(sc); }
      var st0;
      if (window.__bkIconSrc) {
        st0 = el("div", "width:92px;height:92px;border-radius:25px;background:#fff;display:flex;align-items:center;justify-content:center;box-shadow:0 16px 36px rgba(1,54,38,.25);animation:bkFloat 1.6s ease-in-out infinite;");
        var sim = el("img", "width:70px;height:70px;object-fit:contain;"); sim.src = window.__bkIconSrc; sim.alt = "";
        st0.appendChild(sim);
      } else {
        st0 = el("div", "font-size:30px;font-weight:800;", APPNAME);
      }
      var st1 = el("div", "font-size:18px;font-weight:800;"); st1.id = "bk-syncing-t";
      var st2 = el("div", "font-size:13px;opacity:.75;max-width:290px;line-height:1.5;"); st2.id = "bk-syncing-s";
      syncOv.appendChild(st0); syncOv.appendChild(st1); syncOv.appendChild(st2);
    }
    var S = STR[lang] || STR.bn, P = THEMES[theme];
    syncOv.style.background = P.page; syncOv.style.color = P.title;
    syncOv.querySelector("#bk-syncing-t").textContent = S.syncing || "Loading…";
    syncOv.querySelector("#bk-syncing-s").textContent = S.syncingSub || "";
    if (!syncOv.parentNode) document.body.appendChild(syncOv);
    syncOv.style.display = "flex";
    window.clearTimeout(syncTO);
    syncTO = window.setTimeout(hideSyncing, 8000);
  }
  function hideSyncing() { if (syncOv) syncOv.style.display = "none"; window.clearTimeout(syncTO); }

  /* ---------------- account card in More page ---------------- */
  var authKnown = false;
  function renderAccount() {
    var box = document.getElementById("bkAccount");
    if (!box || !authKnown) return;
    var S = STR[lang] || STR.bn;
    box.innerHTML = "";
    var card = el("div", "display:flex;align-items:center;gap:12px;background:var(--card,#fff);border:1px solid var(--line,#e5e7eb);border-radius:20px;padding:14px 16px;margin:14px 0 0;box-shadow:0 6px 18px rgba(1,54,38,.06);");
    if (currentUser) {
      var nm = currentUser.displayName || (currentUser.email ? currentUser.email.split("@")[0] : "");
      var av = el("div", "width:48px;height:48px;border-radius:50%;flex:none;display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:800;color:#fff;background:linear-gradient(135deg,#0D9488,#01452C);", (nm || "?").trim().charAt(0).toUpperCase());
      var mid = el("div", "flex:1;min-width:0;");
      var n1 = el("div", "font-size:15.5px;font-weight:700;color:var(--ink,#111827);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;", nm);
      var n2 = el("div", "font-size:12.5px;color:var(--muted,#6b7280);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;", currentUser.email || "");
      mid.appendChild(n1); mid.appendChild(n2);
      var out = el("button", "flex:none;padding:8px 14px;border-radius:999px;border:1.5px solid #f3c2c2;background:#fff5f5;color:#d92d20;font-size:13px;font-weight:700;cursor:pointer;", S.logout);
      out.onclick = function () { auth.signOut(); };
      card.appendChild(av); card.appendChild(mid); card.appendChild(out);
    } else {
      var mid2 = el("div", "flex:1;min-width:0;");
      var m1 = el("div", "font-size:15.5px;font-weight:700;color:var(--ink,#111827);", S.loginBtn);
      var m2 = el("div", "font-size:12.5px;color:var(--muted,#6b7280);", S.loginSub);
      mid2.appendChild(m1); mid2.appendChild(m2);
      var go = el("button", "flex:none;padding:9px 16px;border-radius:999px;border:0;background:" + ACCENT + ";color:#fff;font-size:13.5px;font-weight:700;cursor:pointer;", S.loginBtn);
      go.onclick = function () {
        try { sessionStorage.removeItem(SKIP); } catch (e) {}
        showOverlay();
      };
      card.appendChild(mid2); card.appendChild(go);
    }
    box.appendChild(card);
  }
  try {
    var mo = new MutationObserver(function () {
      var b = document.getElementById("bkAccount");
      if (b && !b.firstChild) renderAccount();
    });
    mo.observe(document.documentElement, { childList: true, subtree: true });
  } catch (e) {}

  /* ---------------- auth state ---------------- */
  auth.onAuthStateChanged(function (user) {
    authKnown = true;
    currentUser = user || null;
    lang = savedLang();
    theme = savedTheme();
    if (currentUser) {
      try { sessionStorage.removeItem(SKIP); } catch (e) {}
      hideOverlay();
      renderAccount();
      if (ownerSwitch(currentUser)) return;
      if (localIsEmpty() || !localTs()) showSyncing();
      syncOnLogin();
    } else {
      renderAccount();
      var skipped = false;
      try { skipped = !!sessionStorage.getItem(SKIP); } catch (e) {}
      if (!skipped) showOverlay(); else hideOverlay();
    }
  });
})();
