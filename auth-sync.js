/* Hisab Koi! — login + cloud sync layer (web version only).
 *
 * Adds email/password register & login (Firebase Auth) and automatic
 * backup of the whole local database to Firestore (users/{uid}.db).
 * The app itself is unchanged: it keeps working offline from
 * localStorage; this layer only mirrors the data to the cloud when a
 * user is logged in, and pulls it down on login on a new device.
 * If Firebase is not configured or the SDK fails to load (offline),
 * the app behaves exactly as before.
 */
(function () {
  var cfg = window.FIREBASE_CONFIG;
  if (!cfg || !cfg.apiKey || cfg.apiKey.indexOf("PASTE") === 0) return;
  if (typeof firebase === "undefined") return;

  var KEY = "hisabkoi-offline-v1";
  var META = "hk-cloud-meta";
  var SKIP = "hk-skip-auth";

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
  function cloudSet(json, ts) {
    return fs.collection("users").doc(currentUser.uid).set(
      { db: json, updatedAt: ts, email: currentUser.email || "", name: currentUser.displayName || "" },
      { merge: true }
    );
  }
  window.__hkPush = function (json) {
    if (!currentUser || applying) return;
    window.clearTimeout(pushTimer);
    pushTimer = window.setTimeout(function () {
      var ts = Date.now();
      cloudSet(json, ts).then(function () { setMeta(ts); }).catch(function () {});
    }, 2500);
  };
  function syncOnLogin() {
    var ref = fs.collection("users").doc(currentUser.uid);
    ref.get().then(function (snap) {
      var local = window.localStorage.getItem(KEY);
      if (snap.exists && snap.data() && snap.data().db) {
        var cdb = snap.data().db, cts = snap.data().updatedAt || 0;
        if (cdb === local) { setMeta(cts); return; }
        if (cts > localTs()) {
          if (sessionStorage.getItem("hk-applied")) return;
          applying = true;
          try { window.localStorage.setItem(KEY, cdb); } catch (e) {}
          setMeta(cts);
          sessionStorage.setItem("hk-applied", "1");
          window.location.reload();
        } else if (local) {
          var ts = Date.now();
          cloudSet(local, ts).then(function () { setMeta(ts); }).catch(function () {});
        }
      } else if (local) {
        var ts2 = Date.now();
        cloudSet(local, ts2).then(function () { setMeta(ts2); }).catch(function () {});
      }
    }).catch(function () {});
  }

  /* ---------------- login overlay ---------------- */
  var overlay = null;
  function el(tag, css, text) {
    var n = document.createElement(tag);
    if (css) n.style.cssText = css;
    if (text != null) n.textContent = text;
    return n;
  }
  var INP = "width:100%;box-sizing:border-box;padding:12px 14px;margin:0 0 10px;border-radius:12px;border:1px solid #2b4a3e;background:#10201a;color:#fff;font-size:16px;outline:none;";
  function errText(code) {
    switch (code) {
      case "auth/invalid-email": return "ইমেইলটা ঠিক নয় — আবার দেখুন।";
      case "auth/user-not-found":
      case "auth/wrong-password":
      case "auth/invalid-credential": return "ইমেইল বা পাসওয়ার্ড মিলছে না।";
      case "auth/email-already-in-use": return "এই ইমেইল দিয়ে আগেই অ্যাকাউন্ট আছে — লগিন করুন।";
      case "auth/weak-password": return "পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।";
      case "auth/network-request-failed": return "ইন্টারনেট সংযোগ পাওয়া যাচ্ছে না — আবার চেষ্টা করুন।";
      case "auth/too-many-requests": return "অনেকবার চেষ্টা হয়েছে — একটু পরে আবার চেষ্টা করুন।";
      default: return "কিছু সমস্যা হয়েছে — আবার চেষ্টা করুন।";
    }
  }
  function buildOverlay() {
    overlay = el("div", "position:fixed;inset:0;z-index:99999;background:#0b1512;display:flex;align-items:center;justify-content:center;padding:18px;overflow:auto;font-family:inherit;");
    var card = el("div", "width:100%;max-width:380px;background:#122019;border:1px solid #234534;border-radius:20px;padding:22px 20px;box-shadow:0 10px 40px rgba(0,0,0,.5);");
    var title = el("div", "text-align:center;font-size:24px;font-weight:800;color:#fff;", "হিসাব কই!");
    var sub = el("div", "text-align:center;font-size:13px;color:#9db8ab;margin:6px 0 16px;", "লগিন করলে আপনার হিসাব সব ডিভাইসে অটোমেটিক পাবেন");
    var tabs = el("div", "display:flex;gap:8px;margin-bottom:16px;");
    var tabLogin = el("button", "", "লগিন");
    var tabReg = el("button", "", "রেজিস্টার");
    function tabCss(active) {
      return "flex:1;padding:10px;border-radius:12px;border:0;font-size:15px;font-weight:700;cursor:pointer;" +
        (active ? "background:#0D9488;color:#fff;" : "background:#1a2f26;color:#9db8ab;");
    }
    var nameIn = el("input", INP); nameIn.type = "text"; nameIn.placeholder = "আপনার নাম — যেমন: সাহির আল ইয়াসির"; nameIn.autocomplete = "name";
    var mailIn = el("input", INP); mailIn.type = "email"; mailIn.placeholder = "ইমেইল"; mailIn.autocomplete = "email";
    var passIn = el("input", INP); passIn.type = "password"; passIn.placeholder = "পাসওয়ার্ড (কমপক্ষে ৬ অক্ষর)"; passIn.autocomplete = "current-password";
    var msg = el("div", "min-height:20px;font-size:13px;margin:2px 0 8px;color:#f87171;");
    var goBtn = el("button", "width:100%;padding:13px;border:0;border-radius:12px;background:#0D9488;color:#fff;font-size:16px;font-weight:800;cursor:pointer;", "লগিন করুন");
    var forgot = el("button", "display:block;margin:12px auto 0;background:none;border:0;color:#7BD4A6;font-size:13px;cursor:pointer;", "পাসওয়ার্ড ভুলে গেছেন?");
    var skip = el("button", "display:block;margin:14px auto 0;background:none;border:0;color:#8aa79a;font-size:13px;cursor:pointer;text-decoration:underline;", "লগিন ছাড়া চালান — হিসাব শুধু এই ডিভাইসেই থাকবে");
    var mode = "login";
    function setMode(m) {
      mode = m;
      tabLogin.style.cssText = tabCss(m === "login");
      tabReg.style.cssText = tabCss(m === "register");
      nameIn.style.display = m === "register" ? "block" : "none";
      goBtn.textContent = m === "register" ? "রেজিস্টার করুন" : "লগিন করুন";
      forgot.style.display = m === "register" ? "none" : "block";
      msg.textContent = "";
    }
    tabLogin.onclick = function () { setMode("login"); };
    tabReg.onclick = function () { setMode("register"); };
    goBtn.onclick = function () {
      var email = mailIn.value.trim(), pass = passIn.value;
      if (!email || !pass) { msg.style.color = "#f87171"; msg.textContent = "ইমেইল আর পাসওয়ার্ড দিন।"; return; }
      goBtn.disabled = true; goBtn.textContent = "অপেক্ষা করুন…"; msg.textContent = "";
      var done = function () { goBtn.disabled = false; setMode(mode); };
      if (mode === "register") {
        var nm = nameIn.value.trim();
        if (!nm) { msg.style.color = "#f87171"; msg.textContent = "আপনার নাম লিখুন।"; done(); return; }
        auth.createUserWithEmailAndPassword(email, pass)
          .then(function (cred) { return cred.user.updateProfile({ displayName: nm }); })
          .then(function () { done(); })
          .catch(function (e) { msg.style.color = "#f87171"; msg.textContent = errText(e && e.code); done(); });
      } else {
        auth.signInWithEmailAndPassword(email, pass)
          .then(function () { done(); })
          .catch(function (e) { msg.style.color = "#f87171"; msg.textContent = errText(e && e.code); done(); });
      }
    };
    forgot.onclick = function () {
      var email = mailIn.value.trim();
      if (!email) { msg.style.color = "#f87171"; msg.textContent = "আগে ইমেইলটা লিখুন, তারপর চাপুন।"; return; }
      auth.sendPasswordResetEmail(email).then(function () {
        msg.style.color = "#7BD4A6"; msg.textContent = "পাসওয়ার্ড বদলানোর লিংক আপনার ইমেইলে পাঠানো হয়েছে।";
      }).catch(function (e) { msg.style.color = "#f87171"; msg.textContent = errText(e && e.code); });
    };
    skip.onclick = function () {
      try { sessionStorage.setItem(SKIP, "1"); } catch (e) {}
      hideOverlay();
    };
    tabs.appendChild(tabLogin); tabs.appendChild(tabReg);
    card.appendChild(title); card.appendChild(sub); card.appendChild(tabs);
    card.appendChild(nameIn); card.appendChild(mailIn); card.appendChild(passIn);
    card.appendChild(msg); card.appendChild(goBtn); card.appendChild(forgot); card.appendChild(skip);
    overlay.appendChild(card);
    setMode("login");
  }
  function showOverlay() {
    if (!document.body) { document.addEventListener("DOMContentLoaded", showOverlay); return; }
    if (!overlay) buildOverlay();
    if (!overlay.parentNode) document.body.appendChild(overlay);
    overlay.style.display = "flex";
  }
  function hideOverlay() { if (overlay) overlay.style.display = "none"; }

  /* ---------------- account box in More page ---------------- */
  function injectAccountBox() {
    if (!currentUser || document.getElementById("hk-account-box")) return;
    var nodes = document.querySelectorAll("p,span,div");
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      if (n.children.length === 0 && n.textContent && n.textContent.indexOf("এই অ্যাপটি বানিয়েছেন") >= 0) {
        var host = n.parentElement || n;
        var box = el("div", "margin-top:14px;padding:12px 14px;border-radius:14px;background:rgba(13,148,136,.12);border:1px solid rgba(13,148,136,.35);");
        box.id = "hk-account-box";
        var who = el("div", "font-size:13px;opacity:.85;", "লগিন আছেন: " + (currentUser.displayName ? currentUser.displayName + " · " : "") + (currentUser.email || ""));
        var out = el("button", "margin-top:8px;padding:8px 16px;border-radius:10px;border:0;background:#0D9488;color:#fff;font-size:14px;font-weight:700;cursor:pointer;", "লগআউট");
        out.onclick = function () {
          auth.signOut().then(function () {
            try { window.localStorage.removeItem(META); } catch (e) {}
            window.location.reload();
          });
        };
        box.appendChild(who); box.appendChild(out);
        host.appendChild(box);
        return;
      }
    }
  }

  /* ---------------- auth state ---------------- */
  auth.onAuthStateChanged(function (user) {
    currentUser = user || null;
    if (user) {
      hideOverlay();
      sessionStorage.removeItem("hk-applied");
      syncOnLogin();
      injectAccountBox();
    } else {
      var skipped = false;
      try { skipped = sessionStorage.getItem(SKIP) === "1"; } catch (e) {}
      if (!skipped) showOverlay();
    }
  });
  if (window.MutationObserver) {
    var mo = new MutationObserver(function () { injectAccountBox(); });
    document.addEventListener("DOMContentLoaded", function () {
      if (document.body) mo.observe(document.body, { childList: true, subtree: true });
    });
  }
})();
