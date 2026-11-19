/* Hisab Koi! — login + cloud sync layer (web version only).
 *
 * Adds email/password register & login (Firebase Auth) and automatic
 * backup of the whole local database to Firestore (users/{uid}.db).
 * The app itself is unchanged: it keeps working offline from
 * localStorage; this layer only mirrors the data to the cloud when a
 * user is logged in, and pulls it down on login on a new device.
 * If Firebase is not configured or the SDK fails to load (offline),
 * the app behaves exactly as before.
 *
 * The login screen follows the app's own choices: language comes from
 * the app's localStorage key "taka-hisab-lang" (bn/en) and can be
 * switched on the login screen itself (the app then opens in the same
 * language); the theme starts from the app's time-based rule
 * (dark 18:00-06:00) and can be toggled for the session, like in the app.
 */
(function () {
  var cfg = window.FIREBASE_CONFIG;
  if (!cfg || !cfg.apiKey || cfg.apiKey.indexOf("PASTE") === 0) return;
  if (typeof firebase === "undefined") return;

  var KEY = "hisabkoi-offline-v1";
  var META = "hk-cloud-meta";
  var SKIP = "hk-skip-auth";
  var LOGO = "data:image/webp;base64,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";
  var LANG_KEY = "taka-hisab-lang";

  var lang = "bn";
  try {
    var lg = window.localStorage.getItem(LANG_KEY);
    if (lg === "en" || lg === "bn") lang = lg;
  } catch (e) {}
  function autoTheme() {
    try {
      var t = document.documentElement && document.documentElement.dataset ? document.documentElement.dataset.theme : null;
      if (t === "dark" || t === "light") return t;
    } catch (e) {}
    try { var s = window.localStorage.getItem("taka-hisab-theme"); if (s === "dark" || s === "light") return s; } catch (e) {}
    return "light";
  }
  var theme = autoTheme();

  var STR = {
    bn: {
      appName: "হিসাব কই",
      sub: "লগিন করলে আপনার হিসাব সব ডিভাইসে অটোমেটিক পাবেন",
      tabLogin: "লগিন", tabReg: "রেজিস্টার",
      namePh: "আপনার নাম — যেমন: সাহির আল ইয়াসির",
      mailPh: "ইমেইল",
      passPh: "পাসওয়ার্ড (কমপক্ষে ৬ অক্ষর)",
      goLogin: "লগিন করুন", goReg: "রেজিস্টার করুন",
      forgot: "পাসওয়ার্ড ভুলে গেছেন?",
      skip: "লগিন ছাড়া চালান — হিসাব শুধু এই ডিভাইসেই থাকবে",
      wait: "অপেক্ষা করুন…",
      syncing: "আপনার হিসাব লোড হচ্ছে…",
      syncingSub: "সার্ভার থেকে আপনার লেনদেন আনা হচ্ছে — একটু অপেক্ষা করুন। অ্যাপ খালি দেখালেও আপনার সব ডেটা নিরাপদে আছে।",
      needBoth: "ইমেইল আর পাসওয়ার্ড দিন।",
      needName: "আপনার নাম লিখুন।",
      needMailFirst: "আগে ইমেইলটা লিখুন, তারপর চাপুন।",
      resetSent: "পাসওয়ার্ড বদলানোর লিংক আপনার ইমেইলে পাঠানো হয়েছে।",
      loggedInAs: "লগিন আছেন: ", logout: "লগআউট", avatarChange: "ছবি বদলান", avatarRemove: "ছবি সরান", avatarCancel: "বাতিল", remember: "আমাকে মনে রাখুন",
      support: "অ্যাপটিকে সাপোর্ট করুন", supportSub: "ভালো লাগলে ডোনেট করুন", aboutHead: "সম্পর্কে", aboutTitle: "হিসাব কই! ও AURYQEN সম্পর্কে", aboutSub: "কে বানিয়েছে, আর যোগাযোগের উপায়", aboutText: "হিসাব কই! আপনার প্রতিদিনের আয়-ব্যয়ের হিসাব রাখার সহজ বাংলা অ্যাপ। এটি AURYQEN-এর একটি পণ্য।", versionLbl: "সংস্করণ", productBy: "A product by", contact: "যোগাযোগ", settingsHead: "সেটিংস", languageLbl: "ভাষা", themeLbl: "থিম", currencyLbl: "কারেন্সি",
      donateMsg: "হিসাব কই! সম্পূর্ণ ফ্রি একটি অ্যাপ। অ্যাপটি চালু রাখতে আর নতুন নতুন ফিচার আনতে আপনার ছোট্ট সাপোর্ট অনেক বড় সাহায্য হবে।",
      personal: "পার্সোনাল", copyBtn: "কপি করুন", copied: "কপি হয়েছে ✓",
      donateNote: "বিকাশ বা নগদ অ্যাপ থেকে উপরের নম্বরে Send Money করুন।",
      donateThanks: "ভালোবাসা আর সাপোর্টের জন্য ধন্যবাদ ❤️", backBtn: "‹ ফিরে যান"
    },
    en: {
      appName: "Hisab Koi",
      sub: "Log in to get your accounts automatically on every device",
      tabLogin: "Log in", tabReg: "Register",
      namePh: "Your name — e.g.: Saheer Al Yasir",
      mailPh: "Email",
      passPh: "Password (at least 6 characters)",
      goLogin: "Log in", goReg: "Register",
      forgot: "Forgot password?",
      skip: "Continue without login — data stays on this device only",
      wait: "Please wait…",
      syncing: "Loading your accounts…",
      syncingSub: "Fetching your transactions from the server — please wait. Even if the app looks empty, all your data is safe.",
      needBoth: "Enter your email and password.",
      needName: "Please enter your name.",
      needMailFirst: "Enter your email first, then tap.",
      resetSent: "A password reset link has been sent to your email.",
      loggedInAs: "Logged in as: ", logout: "Log out", avatarChange: "Change photo", avatarRemove: "Remove photo", avatarCancel: "Cancel", remember: "Remember me",
      support: "Support this app", supportSub: "Donate if you find it useful", aboutHead: "About", aboutTitle: "About Hisab Koi! & AURYQEN", aboutSub: "Who makes it, and how to reach us", aboutText: "Hisab Koi! is a simple app for tracking your daily income and expenses. It is a product of AURYQEN.", versionLbl: "Version", productBy: "A product by", contact: "Contact", settingsHead: "Settings", languageLbl: "Language", themeLbl: "Theme", currencyLbl: "Currency",
      donateMsg: "Hisab Koi! is a completely free app. Your small support helps keep it running and bring new features.",
      personal: "Personal", copyBtn: "Copy", copied: "Copied ✓",
      donateNote: "Send money to the number above from your bKash or Nagad app.",
      donateThanks: "Thank you for your love and support ❤️", backBtn: "‹ Back"
    }
  ,ja:{appName:"Hisab Koi",sub:"ログインすると、すべてのデバイスで自動的に記録が見られます",tabLogin:"ログイン",tabReg:"新規登録",namePh:"お名前 — 例：Saheer Al Yasir",mailPh:"メールアドレス",passPh:"パスワード（6文字以上）",goLogin:"ログイン",goReg:"登録する",forgot:"パスワードをお忘れですか？",skip:"ログインせずに続ける — データはこのデバイスにのみ保存されます",wait:"お待ちください…",needBoth:"メールアドレスとパスワードを入力してください。",needName:"お名前を入力してください。",needMailFirst:"先にメールアドレスを入力してからタップしてください。",resetSent:"パスワード再設定リンクをメールに送信しました。",loggedInAs:"ログイン中： ",logout:"ログアウト",avatarChange:"写真を変更",avatarRemove:"写真を削除",avatarCancel:"キャンセル",remember:"ログイン状態を保持",support:"このアプリを支援する",supportSub:"役に立ったら寄付してください",aboutHead:"アプリについて",aboutTitle:"Hisab Koi! と AURYQEN について",aboutSub:"制作者と連絡方法",aboutText:"Hisab Koi! は、日々の収入と支出を記録するシンプルなアプリです。AURYQEN の製品です。",versionLbl:"バージョン",productBy:"A product by",contact:"連絡先",settingsHead:"設定",languageLbl:"言語",themeLbl:"テーマ",currencyLbl:"通貨",donateMsg:"Hisab Koi! は完全無料のアプリです。皆さまの小さな支援が、運営と新機能の追加を支えます。",personal:"個人",copyBtn:"コピー",copied:"コピーしました ✓",donateNote:"bKash または Nagad アプリから上記の番号に送金してください。",donateThanks:"ご支援ありがとうございます ❤️",backBtn:"‹ 戻る"}};
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
      page: "linear-gradient(160deg,#0D9488 0%,#0a7268 55%,#316750 100%)",
      card: "background:#ffffff;border:1px solid transparent;",
      title: "#122019", sub: "#5b7267",
      input: "border:1.5px solid #cfe0d7;background:#f3f8f5;color:#122019;",
      tabOff: "background:#e7f2ee;color:#40685a;",
      err: "#d92d20", ok: "#15803d",
      forgot: "#0D9488", skip: "#6b8578",
      ctrl: "background:rgba(255,255,255,.92);color:#0a4f46;border:1px solid rgba(255,255,255,.65);"
    },
    dark: {
      page: "linear-gradient(160deg,#0a2e29 0%,#071f1b 55%,#0b1512 100%)",
      card: "background:#122019;border:1px solid #234534;",
      title: "#ffffff", sub: "#9db8ab",
      input: "border:1.5px solid #2b4a3e;background:#10201a;color:#ffffff;",
      tabOff: "background:#1a2f26;color:#9db8ab;",
      err: "#f87171", ok: "#7BD4A6",
      forgot: "#7BD4A6", skip: "#8aa79a",
      ctrl: "background:rgba(10,30,25,.88);color:#cfe8dd;border:1px solid #234534;"
    }
  };

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
        if (cdb === local) { setMeta(cts); hideSyncing(); return; }
        if (cts > localTs()) {
          if (sessionStorage.getItem("hk-applied")) { hideSyncing(); return; }
          applying = true;
          try { window.localStorage.setItem(KEY, cdb); } catch (e) {}
          setMeta(cts);
          sessionStorage.setItem("hk-applied", "1");
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
    }).catch(function () { hideSyncing(); });
  }

  /* ---------------- daily line (verse/hadith <-> motivation, alternating days) ---------------- */
  var HK_VERSES_BN = [
    "যে আল্লাহর ওপর ভরসা করে, আল্লাহ তাকে এমন জায়গা থেকে রিজিক দেন, যা সে কল্পনাও করে না। — সূরা আত-তালাক: ৩",
    "সত্যবাদী ও বিশ্বস্ত ব্যবসায়ী (কিয়ামতের দিন) নবী, সিদ্দীক ও শহীদদের সঙ্গে থাকবেন। — তিরমিজি",
    "নিশ্চয়ই কষ্টের সঙ্গেই আছে স্বস্তি। — সূরা আশ-শারহ: ৬",
    "কেউ কখনো নিজের হাতের উপার্জনের চেয়ে উত্তম খাবার খায়নি। — সহীহ বুখারী",
    "আল্লাহ কারো ওপর তার সাধ্যের অতিরিক্ত বোঝা চাপান না। — সূরা বাকারা: ২৮৬",
    "সম্পদের প্রাচুর্যই ধনী হওয়া নয়; মনের প্রাচুর্যই আসল ধন। — সহীহ বুখারী ও মুসলিম",
    "খাও ও পান করো, কিন্তু অপচয় করো না। — সূরা আল-আরাফ: ৩১",
    "সামর্থ্য থাকা সত্ত্বেও ঋণ শোধে দেরি করা জুলুম। — সহীহ বুখারী ও মুসলিম",
    "নিশ্চয়ই আল্লাহ ধৈর্যশীলদের সঙ্গে আছেন। — সূরা বাকারা: ১৫৩",
    "যে ফেরত দেওয়ার নিয়তে ঋণ নেয়, আল্লাহ তাকে তা শোধ করার তৌফিক দেন। — সহীহ বুখারী",
    "তোমরা ধৈর্য ও নামাজের মাধ্যমে সাহায্য প্রার্থনা করো। — সূরা বাকারা: ৪৫",
    "নিশ্চয়ই অপচয়কারীরা শয়তানের ভাই। — সূরা বনি ইসরাইল: ২৭"
  ];
  var HK_MOT_BN = [
    "ছোট ছোট সঞ্চয়ই একদিন বড় নিরাপত্তা গড়ে।",
    "আজকের হিসাব আজকেই লিখুন — কাল ভুলে যাবেন।",
    "অপচয় কমালেই আয় বাড়ে।",
    "প্রতিদিন একটু করে এগিয়ে যাওয়াই আসল সফলতা।",
    "টাকা বাঁচানো মানে ভবিষ্যতের নিজেকে উপহার দেওয়া।",
    "যে নিজের হিসাব জানে, সে নিজের পথও জানে।",
    "ঋণমুক্ত জীবনই আসল স্বাধীনতা।",
    "আজ যা কঠিন, নিয়মিত করলে কাল তা-ই অভ্যাস।",
    "বড় স্বপ্ন দেখুন, ছোট পদক্ষেপে শুরু করুন।",
    "সময় আর টাকা — দুটোই বাজেট করে চলুন।",
    "আজকের পরিশ্রমই আগামীর স্বস্তি।",
    "ব্যর্থতা মানে শেষ নয়, মানে নতুন করে শেখা।"
  ];
  var HK_VERSES_EN = [
    "Whoever trusts in Allah, He provides for him from where he does not expect. — Surah At-Talaq: 3",
    "The truthful, trustworthy merchant will be with the prophets, the truthful and the martyrs. — Tirmidhi",
    "Indeed, with hardship comes ease. — Surah Ash-Sharh: 6",
    "No one eats better food than that earned by his own hands. — Sahih al-Bukhari",
    "Allah does not burden a soul beyond what it can bear. — Surah Al-Baqarah: 286",
    "Richness is not having many possessions; richness is contentment of the soul. — Bukhari & Muslim",
    "Eat and drink, but do not waste. — Surah Al-A'raf: 31",
    "Delaying repayment while being able is an injustice. — Bukhari & Muslim",
    "Indeed, Allah is with the patient. — Surah Al-Baqarah: 153",
    "Whoever borrows intending to repay, Allah helps him repay it. — Sahih al-Bukhari",
    "Seek help through patience and prayer. — Surah Al-Baqarah: 45",
    "Indeed, the wasteful are brothers of the devils. — Surah Al-Isra: 27"
  ];
  var HK_MOT_EN = [
    "Small savings today build big security tomorrow.",
    "Write today's accounts today — tomorrow you will forget.",
    "Cutting waste is the same as raising income.",
    "A little progress every day is real success.",
    "Saving money is a gift to your future self.",
    "Know your accounts, and you know your path.",
    "A debt-free life is true freedom.",
    "What is hard today becomes a habit tomorrow.",
    "Dream big, start with small steps.",
    "Budget both your time and your money.",
    "Today's hard work is tomorrow's comfort.",
    "Failure is not the end — it is a new lesson."
  ];
  window.__hkDaily = function (lg) {
    try {
      var now = new Date();
      var day = Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86400000);
      var en; if (lg === "en") en = true; else if (lg === "bn") en = false; else { try { en = localStorage.getItem("taka-hisab-lang") !== "bn"; } catch (e2) { en = (typeof lang !== "undefined" && lang === "en"); } }
      var verses = en ? HK_VERSES_EN : HK_VERSES_BN;
      var mots = en ? HK_MOT_EN : HK_MOT_BN;
      var idx = Math.floor(day / 2) % verses.length;
      return day % 2 === 0 ? verses[idx] : mots[idx];
    } catch (e) { return null; }
  };

  /* ---------------- login overlay ---------------- */
  var overlay = null, R = null, mode = "login";
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
  function buildOverlay() {
    overlay = el("div", "position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;padding:18px;overflow:auto;font-family:inherit;");
    var ctrls = el("div", "position:absolute;top:14px;right:14px;display:flex;gap:8px;align-items:center;");
    var langBn = el("button", "", "বাংলা");
    var langEn = el("button", "", "EN");
    var langBox = el("div", "display:flex;border-radius:999px;overflow:hidden;");
    langBox.appendChild(langBn); langBox.appendChild(langEn);
    var themeBtn = el("button", "", "🌙");
    ctrls.appendChild(langBox); ctrls.appendChild(themeBtn);
    var card = el("div", "width:100%;max-width:380px;border-radius:24px;padding:26px 22px 22px;box-shadow:0 18px 50px rgba(0,40,32,.35);");
    var logo = el("img", "width:33px;height:33px;display:block;flex:none;"); var logoWrap = el("div", "width:30px;height:30px;border-radius:50%;overflow:hidden;display:flex;align-items:center;justify-content:center;flex:none;background:#316750;"); logoWrap.appendChild(logo);
    logo.src = LOGO; logo.alt = "Hisab Koi!";
    var title = el("div", "display:flex;align-items:center;justify-content:center;gap:8px;font-size:25px;font-weight:800;");
    var titleName = el("span", "");
    var titleBang = el("span", "color:#e11d2e;", "!");
    title.appendChild(titleName); title.appendChild(titleBang);
    var sub = el("div", "text-align:center;font-size:13px;margin:6px 0 16px;");
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
    eye.textContent = "\uD83D\uDE48";
    passWrap.appendChild(passIn); passWrap.appendChild(eye);
    var remRow = el("label", "display:flex;align-items:center;gap:8px;font-size:14px;margin:0 0 8px;cursor:pointer;");
    var remIn = el("input", "width:17px;height:17px;accent-color:#0D9488;margin:0;"); remIn.type = "checkbox"; remIn.checked = true;
    var remTxt = el("span", "");
    remRow.appendChild(remIn); remRow.appendChild(remTxt);
    var msg = el("div", "min-height:20px;font-size:13px;margin:2px 0 8px;");
    var goBtn = el("button", "width:100%;padding:13px;border:0;border-radius:12px;background:#0D9488;color:#fff;font-size:16px;font-weight:800;cursor:pointer;");
    var forgot = el("button", "display:block;margin:12px auto 0;background:none;border:0;font-size:13px;cursor:pointer;font-weight:600;");
    var skip = el("button", "display:block;margin:14px auto 0;background:none;border:0;font-size:13px;cursor:pointer;text-decoration:underline;");
    title.insertBefore(logoWrap, title.firstChild); card.appendChild(title); card.appendChild(sub);
    card.appendChild(tabs);
    card.appendChild(nameIn); card.appendChild(mailIn); card.appendChild(passWrap); card.appendChild(remRow);
    card.appendChild(msg); card.appendChild(goBtn); card.appendChild(forgot); card.appendChild(skip);
    overlay.appendChild(ctrls); overlay.appendChild(card);
    R = { overlay: overlay, card: card, title: title, titleName: titleName, sub: sub,
          tabLogin: tabLogin, tabReg: tabReg, nameIn: nameIn, mailIn: mailIn, passIn: passIn, passWrap: passWrap, eye: eye, remIn: remIn, remTxt: remTxt,
          msg: msg, goBtn: goBtn, forgot: forgot, skip: skip,
          langBn: langBn, langEn: langEn, langBox: langBox, themeBtn: themeBtn };
    tabLogin.onclick = function () { mode = "login"; paint(); };
    tabReg.onclick = function () { mode = "register"; paint(); };
    langBn.onclick = function () { setLang("bn"); };
    langEn.onclick = function () { setLang("en"); };
    themeBtn.onclick = function () { theme = theme === "dark" ? "light" : "dark"; try { window.localStorage.setItem("taka-hisab-theme", theme); } catch (e) {} paint(); };
    eye.onclick = function () {
      var show = passIn.type === "password";
      passIn.type = show ? "text" : "password";
      if (show) { eye.textContent = "\uD83D\uDC40"; } else { eye.textContent = "\uD83D\uDE48"; }
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
  function setLang(l) {
    lang = l;
    try { window.localStorage.setItem(LANG_KEY, l); } catch (e) {}
    paint();
  }
  function paint() {
    if (!R) return;
    var S = STR[lang], P = THEMES[theme];
    R.overlay.style.background = P.page;
    R.card.style.cssText = "width:100%;max-width:380px;border-radius:24px;padding:26px 22px 22px;box-shadow:0 18px 50px rgba(0,40,32,.35);" + P.card;
    R.title.style.color = P.title;
    R.titleName.textContent = S.appName;
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
        (active ? "background:#0D9488;color:#fff;" : P.tabOff);
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
    R.langBn.style.cssText = ctrlBtn + (lang === "bn" ? "background:#0D9488;color:#fff;" : "background:transparent;color:inherit;");
    R.langEn.style.cssText = ctrlBtn + (lang === "en" ? "background:#0D9488;color:#fff;" : "background:transparent;color:inherit;");
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
  var syncOv = null, syncTO = null;
  function showSyncing() {
    if (!document.body) return;
    if (!syncOv) {
      syncOv = el("div", "position:fixed;inset:0;z-index:99998;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:24px;text-align:center;");
      syncOv.id = "hk-syncing";
      var sim = el("img", "width:72px;height:72px;border-radius:50%;object-fit:cover;");
      sim.src = LOGO; sim.alt = "";
      var st1 = el("div", "font-size:18px;font-weight:800;"); st1.id = "hk-syncing-t";
      var st2 = el("div", "font-size:13px;opacity:.75;max-width:290px;line-height:1.5;"); st2.id = "hk-syncing-s";
      syncOv.appendChild(sim); syncOv.appendChild(st1); syncOv.appendChild(st2);
    }
    var S = STR[lang] || STR.bn, P = THEMES[theme];
    syncOv.style.background = P.page; syncOv.style.color = P.title;
    syncOv.querySelector("#hk-syncing-t").textContent = S.syncing || "Loading…";
    syncOv.querySelector("#hk-syncing-s").textContent = S.syncingSub || "";
    if (!syncOv.parentNode) document.body.appendChild(syncOv);
    syncOv.style.display = "flex";
    window.clearTimeout(syncTO);
    syncTO = window.setTimeout(hideSyncing, 30000);
  }
  function hideSyncing() { if (syncOv) syncOv.style.display = "none"; window.clearTimeout(syncTO); }

  /* ---------------- account box in More page ---------------- */
  function fbPill() {
    var as = document.querySelectorAll('a[href*="facebook.com/iamskrfarhad007"]');
    for (var i = 0; i < as.length; i++) {
      var n = as[i], mine = false;
      while (n && n !== document.body) { if (n.id && String(n.id).indexOf("hk-") === 0) { mine = true; break; } n = n.parentElement; }
      if (!mine) return as[i];
    }
    return null;
  }
  function moreMounted() {
    if (fbPill()) return true;
    if (document.querySelector('section[aria-label="\u09AC\u09CD\u09AF\u09BE\u0995\u0986\u09AA \u09AB\u09BE\u0987\u09B2"], section[aria-label="Backup File"]')) return true;
    var nodes = document.querySelectorAll("div,span,p,section,button,a");
    for (var i = 0; i < nodes.length; i++) {
      var t = nodes[i].textContent || "";
      if (t.length < 200 && t.indexOf("\u09AC\u09CD\u09AF\u09BE\u0995\u0986\u09AA \u09A1\u09BE\u0989\u09A8\u09B2\u09CB\u09A1") >= 0) return true;
    }
    return false;
  }
  function getAvatar() { try { return window.localStorage.getItem("hk-avatar") || ""; } catch (e) { return ""; } }
  function paintAvatarInto(avEl2) {
    var pic = getAvatar();
    avEl2.innerHTML = "";
    if (pic) {
      var im = document.createElement("img");
      im.src = pic; im.alt = "";
      im.style.cssText = "width:100%;height:100%;object-fit:cover;display:block;";
      avEl2.appendChild(im);
    } else {
      var nm2 = currentUser ? (currentUser.displayName || (currentUser.email ? currentUser.email.split("@")[0] : "")) : "";
      avEl2.textContent = (nm2 || "?").trim().charAt(0).toUpperCase();
    }
  }
  function closeAvatarMenu() { var m = document.getElementById("hk-avatar-menu"); if (m) m.remove(); }
  function pickAvatarFile() {
    closeAvatarMenu();
    var inp = document.createElement("input");
    inp.type = "file"; inp.accept = "image/*";
    inp.onchange = function () {
      var f = inp.files && inp.files[0]; if (!f) return;
      var url = URL.createObjectURL(f);
      var img = new Image();
      img.onload = function () {
        try {
          var w = img.naturalWidth, h = img.naturalHeight, side = Math.min(w, h);
          var cv = document.createElement("canvas"); cv.width = 192; cv.height = 192;
          cv.getContext("2d").drawImage(img, (w - side) / 2, (h - side) / 2, side, side, 0, 0, 192, 192);
          try { window.localStorage.setItem("hk-avatar", cv.toDataURL("image/jpeg", 0.85)); } catch (e) {}
          var c = document.getElementById("hk-avatar-circle"); if (c) paintAvatarInto(c);
        } catch (e2) {}
        URL.revokeObjectURL(url);
      };
      img.onerror = function () { URL.revokeObjectURL(url); };
      img.src = url;
    };
    inp.click();
  }
  function avatarTap() {
    if (!getAvatar()) { pickAvatarFile(); return; }
    if (document.getElementById("hk-avatar-menu")) { closeAvatarMenu(); return; }
    var S = STR[donateLang()];
    var box = document.getElementById("hk-account-box"); if (!box) return;
    var menu = el("div", "position:absolute;left:14px;top:66px;z-index:30;background:var(--surface,#fff);border:1px solid var(--border,rgba(128,128,128,.3));border-radius:12px;box-shadow:0 10px 26px rgba(0,0,0,.18);overflow:hidden;min-width:170px;");
    menu.id = "hk-avatar-menu";
    function row(lbl, fn) {
      var r = el("div", "padding:11px 14px;font-size:14.5px;font-weight:600;cursor:pointer;", lbl);
      r.onclick = function (ev) { ev.stopPropagation(); fn(); };
      return r;
    }
    menu.appendChild(row(S.avatarChange, pickAvatarFile));
    menu.appendChild(row(S.avatarRemove, function () { try { window.localStorage.removeItem("hk-avatar"); } catch (e) {} closeAvatarMenu(); var c = document.getElementById("hk-avatar-circle"); if (c) paintAvatarInto(c); }));
    menu.appendChild(row(S.avatarCancel, closeAvatarMenu));
    box.appendChild(menu);
    setTimeout(function () { document.addEventListener("click", closeAvatarMenu, { once: true }); }, 10);
  }
  function injectAccountBox() {
    var existingBox = document.getElementById("hk-account-box");
    if (existingBox && existingBox.getAttribute("data-hk-lang") !== donateLang()) { existingBox.remove(); existingBox = null; }
    if (existingBox) { if (!moreMounted()) existingBox.remove(); return; }
    if (!currentUser || !moreMounted()) return;
    var box = el("div", "width:100%;box-sizing:border-box;margin-top:20px;padding:14px;border-radius:16px;background:var(--surface,#ffffff);border:1px solid var(--border,rgba(128,128,128,.25));box-shadow:0 4px 14px rgba(0,0,0,.06);display:flex;align-items:center;gap:12px;position:relative;");
    box.id = "hk-account-box";
    box.setAttribute("data-hk-lang", donateLang());
    var l = "bn";
    try { var v = window.localStorage.getItem(LANG_KEY); if (v === "en" || v === "bn") l = v; } catch (e) {}
    var S = STR[l];
    var nm = currentUser.displayName || (currentUser.email ? currentUser.email.split("@")[0] : "");
    var ini = (nm || "?").trim().charAt(0).toUpperCase();
    var avw = el("div", "position:relative;width:46px;height:46px;flex:0 0 auto;cursor:pointer;");
    var av = el("div", "width:46px;height:46px;border-radius:50%;background:linear-gradient(135deg,#0D9488,#2DD4BF);color:#fff;display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:800;overflow:hidden;", ini);
    av.id = "hk-avatar-circle";
    paintAvatarInto(av);
    var badge = el("div", "position:absolute;right:-2px;bottom:-2px;width:17px;height:17px;border-radius:50%;background:#0D9488;border:2px solid var(--surface,#ffffff);display:flex;align-items:center;justify-content:center;");
    badge.innerHTML = '<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>';
    avw.appendChild(av); avw.appendChild(badge);
    avw.onclick = function (ev) { ev.stopPropagation(); avatarTap(); };
    var mid = el("div", "flex:1;min-width:0;text-align:left;");
    mid.appendChild(el("div", "font-size:15.5px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;", nm));
    mid.appendChild(el("div", "font-size:12.5px;opacity:.65;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;", currentUser.email || ""));
    var out = el("button", "flex:0 0 auto;display:inline-flex;align-items:center;gap:8px;padding:9px 16px;border-radius:999px;border:0;background:#0D9488;color:#fff;font-size:14px;font-weight:700;cursor:pointer;box-shadow:0 4px 12px rgba(13,148,136,.35);");
    out.innerHTML = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg><span></span>';
    out.lastChild.textContent = S.logout;
    out.onclick = function () {
      auth.signOut().then(function () {
        try { window.localStorage.removeItem(META); } catch (e) {}
        window.location.reload();
      });
    };
    box.appendChild(avw); box.appendChild(mid); box.appendChild(out);
    var norm = function (x) { return (x || "").replace(/\u09AF\u09BC/g, "\u09DF").replace(/\u09A1\u09BC/g, "\u09DC").replace(/\u09A2\u09BC/g, "\u09DD"); };
    var needle = "\u09AC\u09BE\u09A8\u09BF\u09DF\u09C7\u099B\u09C7\u09A8";
    var fb = fbPill();
    // anchor 1: the wrapper holding BOTH credit line and social pills -> box goes before it (credit stays last)
    if (fb) {
      var w = fb, hops = 0;
      while (w && hops < 6) {
        if (w.parentElement && (norm(w.textContent).indexOf(needle) >= 0 || (w.textContent || "").toLowerCase().indexOf("made by") >= 0) && (w.textContent || "").length < 400) {
          w.parentElement.insertBefore(box, w);
          return;
        }
        w = w.parentElement; hops++;
      }
    }
    // anchor 2: right after the backup card
    var all = document.querySelectorAll("button,a,div,span,p");
    var bk = null;
    for (var i = 0; i < all.length; i++) {
      var t2 = all[i].textContent || "";
      if (t2.indexOf("\u09AC\u09CD\u09AF\u09BE\u0995\u0986\u09AA \u09A1\u09BE\u0989\u09A8\u09B2\u09CB\u09A1") >= 0 && (!bk || t2.length < (bk.textContent || "").length)) bk = all[i];
    }
    if (bk) {
      var card = bk, h2 = 0;
      while (card && h2 < 6) {
        if (card.parentElement && norm(card.textContent).indexOf("\u09AC\u09CD\u09AF\u09BE\u0995\u0986\u09AA \u09AB\u09BE\u0987\u09B2") >= 0 && (card.textContent || "").length > 60) {
          card.parentElement.insertBefore(box, card.nextSibling);
          return;
        }
        card = card.parentElement; h2++;
      }
    }
    // anchor 3: below the social pills row
    if (fb) {
      var row = fb, h3 = 0;
      while (row && h3 < 5) {
        if (row.querySelectorAll && row.querySelectorAll("a").length >= 2 && row.parentElement) {
          row.parentElement.insertBefore(box, row.nextSibling);
          return;
        }
        row = row.parentElement; h3++;
      }
    }
    // anchor 4: right after the credit line element
    var nodes = document.querySelectorAll("div,p,span,section,footer");
    var best = null;
    for (var j = 0; j < nodes.length; j++) {
      var t = norm(nodes[j].textContent);
      if (t.indexOf(needle) >= 0 && (!best || t.length < norm(best.textContent).length)) best = nodes[j];
    }
    if (best && best.parentElement) best.parentElement.insertBefore(box, best.nextSibling);
  }


  /* ---------------- donation (More page) ---------------- */
  var DONATE_NUM = "01793333224";
  function donateLang() {
    var l = "bn";
    try { var v = window.localStorage.getItem(LANG_KEY); if (v === "en" || v === "bn") l = v; } catch (e) {}
    return l;
  }
  function copyDonateNum(btn, S) {
    function done() {
      var old = btn.textContent;
      btn.textContent = S.copied;
      setTimeout(function () { btn.textContent = old; }, 1600);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(DONATE_NUM).then(done, function () { legacyCopy(); done(); });
    } else { legacyCopy(); done(); }
    function legacyCopy() {
      try {
        var ta = document.createElement("textarea");
        ta.value = DONATE_NUM;
        ta.style.position = "fixed"; ta.style.opacity = "0";
        document.body.appendChild(ta); ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      } catch (e) {}
    }
  }
  function openDonatePage() {
    var old = document.getElementById("hk-donate-page");
    if (old) { old.style.display = "block"; return; }
    var S = STR[donateLang()];
    var th = "light";
    try { if (document.documentElement.dataset.theme === "dark") th = "dark"; } catch (e) {}
    var P = THEMES[th];
    var page = el("div", "position:fixed;inset:0;z-index:9998;overflow-y:auto;background:linear-gradient(160deg,#0D9488 0%,#0a7268 55%,#316750 100%);padding:18px;box-sizing:border-box;");
    page.id = "hk-donate-page";
    var back = el("button", "background:rgba(255,255,255,.18);border:0;color:#fff;font-size:15px;font-weight:700;padding:9px 16px;border-radius:999px;cursor:pointer;", S.backBtn);
    back.onclick = function () { page.style.display = "none"; };
    page.appendChild(back);
    var card = el("div", "max-width:430px;margin:16px auto 0;" + P.card + "border-radius:20px;padding:22px 18px;box-sizing:border-box;box-shadow:0 18px 50px rgba(0,0,0,.35);text-align:center;");
    var bdCol = th === "dark" ? "#234534" : "#d8e6de";
    card.appendChild(el("div", "font-size:40px;line-height:1.1;", "\u2764\uFE0F"));
    card.appendChild(el("div", "font-size:20px;font-weight:800;color:" + P.title + ";margin-top:6px;", S.support));
    card.appendChild(el("div", "font-size:14px;line-height:1.65;color:" + P.sub + ";margin-top:8px;", S.donateMsg));
    function method(name, color) {
      var m = el("div", "margin-top:16px;padding:14px;border-radius:14px;border:1px solid " + bdCol + ";text-align:left;");
      var head = el("div", "display:flex;align-items:center;gap:8px;");
      var dot = el("span", "width:12px;height:12px;border-radius:50%;background:" + color + ";display:inline-block;");
      head.appendChild(dot);
      head.appendChild(el("span", "font-size:16px;font-weight:800;color:" + P.title + ";", name));
      head.appendChild(el("span", "font-size:12px;color:" + P.sub + ";", "(" + S.personal + ")"));
      m.appendChild(head);
      var row = el("div", "display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:10px;");
      row.appendChild(el("div", "font-size:21px;font-weight:800;letter-spacing:1px;color:" + P.title + ";", "01793-333224"));
      var cp = el("button", "padding:9px 14px;border-radius:10px;border:0;background:#0D9488;color:#fff;font-size:14px;font-weight:700;cursor:pointer;white-space:nowrap;", S.copyBtn);
      cp.onclick = function () { copyDonateNum(cp, S); };
      row.appendChild(cp);
      m.appendChild(row);
      return m;
    }
    card.appendChild(method("\u09AC\u09BF\u0995\u09BE\u09B6", "#E2136E"));
    card.appendChild(method("\u09A8\u0997\u09A6", "#F6921E"));
    card.appendChild(el("div", "font-size:13px;color:" + P.sub + ";margin-top:14px;line-height:1.6;", S.donateNote));
    card.appendChild(el("div", "font-size:14px;font-weight:700;color:" + P.title + ";margin-top:12px;", S.donateThanks));
    page.appendChild(card);
    document.body.appendChild(page);
  }
  function injectDonateCard() {
    var existingCard = document.getElementById("hk-donate-card");
    if (existingCard && existingCard.getAttribute("data-hk-lang") !== donateLang()) { existingCard.remove(); existingCard = null; }
    if (existingCard) { if (!moreMounted()) existingCard.remove(); return; }
    if (!moreMounted()) return;
    var S = STR[donateLang()];
    var card = el("div", "width:100%;box-sizing:border-box;margin-top:14px;padding:16px;border-radius:18px;background:linear-gradient(120deg,#e11d48 0%,#ec4899 60%,#f472b6 100%);color:#fff;cursor:pointer;box-shadow:0 10px 24px rgba(225,29,72,.30);");
    card.id = "hk-donate-card";
    card.setAttribute("data-hk-lang", donateLang());
    var row = el("div", "display:flex;align-items:center;gap:12px;");
    var heart = el("div", "width:44px;height:44px;border-radius:50%;background:rgba(255,255,255,.25);color:#fff;display:flex;align-items:center;justify-content:center;font-size:21px;flex:0 0 auto;", "\u2764\uFE0F");
    var texts = el("div", "flex:1;text-align:left;");
    texts.appendChild(el("div", "font-size:15px;font-weight:800;", S.support));
    texts.appendChild(el("div", "font-size:12.5px;opacity:.88;margin-top:2px;", S.supportSub));
    var arrow = el("div", "font-size:19px;opacity:.9;", "\u2197");
    row.appendChild(heart); row.appendChild(texts); row.appendChild(arrow);
    card.appendChild(row);
    card.onclick = openDonatePage;
    var acct = document.getElementById("hk-account-box");
    if (acct && acct.parentElement) { acct.parentElement.insertBefore(card, acct); return; }
    var norm = function (x) { return (x || "").replace(/\u09AF\u09BC/g, "\u09DF").replace(/\u09A1\u09BC/g, "\u09DC").replace(/\u09A2\u09BC/g, "\u09DD"); };
    var needle = "\u09AC\u09BE\u09A8\u09BF\u09DF\u09C7\u099B\u09C7\u09A8";
    var fb = fbPill();
    if (fb) {
      var w = fb, hops = 0;
      while (w && hops < 6) {
        if (w.parentElement && norm(w.textContent).indexOf(needle) >= 0 && (w.textContent || "").length < 400) {
          w.parentElement.insertBefore(card, w);
          return;
        }
        w = w.parentElement; hops++;
      }
    }
    var all = document.querySelectorAll("button,a,div,span,p");
    var bk = null;
    for (var i = 0; i < all.length; i++) {
      var t2 = all[i].textContent || "";
      if (t2.indexOf("\u09AC\u09CD\u09AF\u09BE\u0995\u0986\u09AA \u09A1\u09BE\u0989\u09A8\u09B2\u09CB\u09A1") >= 0 && (!bk || t2.length < (bk.textContent || "").length)) bk = all[i];
    }
    if (bk) {
      var c2 = bk, h2 = 0;
      while (c2 && h2 < 6) {
        if (c2.parentElement && norm(c2.textContent).indexOf("\u09AC\u09CD\u09AF\u09BE\u0995\u0986\u09AA \u09AB\u09BE\u0987\u09B2") >= 0 && (c2.textContent || "").length > 60) {
          c2.parentElement.insertBefore(card, c2.nextSibling);
          return;
        }
        c2 = c2.parentElement; h2++;
      }
    }
    if (fb) {
      var r2 = fb, h3 = 0;
      while (r2 && h3 < 5) {
        if (r2.querySelectorAll && r2.querySelectorAll("a").length >= 2 && r2.parentElement) {
          r2.parentElement.insertBefore(card, r2.nextSibling);
          return;
        }
        r2 = r2.parentElement; h3++;
      }
    }
  }



  /* ---------------- settings card (More page) ---------------- */
  var THEME_MODE_KEY = "hk-theme-mode";
  function themeMode() { try { return localStorage.getItem(THEME_MODE_KEY) || "auto"; } catch (e) { return "auto"; } }
  function setThemeMode(v) { try { localStorage.setItem(THEME_MODE_KEY, v); } catch (e) {} }
  function autoTheme() { var h = new Date().getHours(); return (h >= 18 || h < 6) ? "dark" : "light"; }
  function curTheme() { try { return document.documentElement.dataset.theme === "dark" ? "dark" : "light"; } catch (e) { return "light"; } }
  function headerBtns() { return Array.prototype.slice.call(document.querySelectorAll("header button")); }
  function langBtn() {
    var bs = headerBtns();
    for (var i = 0; i < bs.length; i++) {
      var al = bs[i].getAttribute("aria-label") || "";
      if (al === "Switch to English" || al === "日本語に切り替え" || al.indexOf("\u09AC\u09BE\u0982\u09B2\u09BE\u09AF\u09BC") === 0) return bs[i];
    }
    return null;
  }
  function themeBtn() {
    var lb = langBtn(); var bs = headerBtns();
    for (var i = 0; i < bs.length; i++) { if (bs[i] !== lb && bs[i].querySelector("svg")) return bs[i]; }
    return null;
  }
  function applyTheme(target) {
    if (curTheme() === target) return;
    var tb = themeBtn();
    if (tb) { tb.click(); return; }
    try { document.documentElement.dataset.theme = target; } catch (e) {}
  }
  function applyLang(target) {
    if (donateLang() === target) return;
    var lb = langBtn();
    if (!lb) { try { localStorage.setItem("taka-hisab-lang", target); location.reload(); } catch (e) {} return; }
    lb.click();
    var tries = 0;
    var iv = setInterval(function () {
      tries++;
      if (donateLang() === target) { clearInterval(iv); return; }
      if (tries >= 6) { clearInterval(iv); try { localStorage.setItem("taka-hisab-lang", target); location.reload(); } catch (e) {} return; }
      var b2 = langBtn(); if (b2) b2.click();
    }, 180);
  }
  var CURS = [
    { code: "BDT", sym: "\u09F3", bn: "\u099F\u09BE\u0995\u09BE", en: "Taka" },
    { code: "USD", sym: "$", bn: "\u09A1\u09B2\u09BE\u09B0", en: "Dollar" },
    { code: "EUR", sym: "\u20AC", bn: "\u0987\u0989\u09B0\u09CB", en: "Euro" },
    { code: "GBP", sym: "\u00A3", bn: "\u09AA\u09BE\u0989\u09A8\u09CD\u09A1", en: "Pound" },
    { code: "INR", sym: "\u20B9", bn: "\u09B0\u09C1\u09AA\u09BF", en: "Rupee" },
    { code: "AED", sym: "AED ", bn: "\u09A6\u09BF\u09B0\u09B9\u09BE\u09AE", en: "Dirham" },
    { code: "SAR", sym: "SAR ", bn: "\u09B0\u09BF\u09DF\u09BE\u09B2", en: "Riyal" },
    { code: "QAR", sym: "QAR ", bn: "\u09B0\u09BF\u09DF\u09BE\u09B2", en: "Riyal" },
    { code: "KWD", sym: "KWD ", bn: "\u09A6\u09BF\u09A8\u09BE\u09B0", en: "Dinar" },
    { code: "MYR", sym: "RM ", bn: "\u09B0\u09BF\u0999\u09CD\u0997\u09BF\u09A4", en: "Ringgit" },
    { code: "SGD", sym: "S$", bn: "\u09A1\u09B2\u09BE\u09B0", en: "Dollar" }
  ];
  function curObj() {
    var c = "BDT";
    try { c = localStorage.getItem("hk-currency") || "BDT"; } catch (e) {}
    for (var i = 0; i < CURS.length; i++) if (CURS[i].code === c) return CURS[i];
    return CURS[0];
  }
  function setCur(code) {
    try { localStorage.setItem("hk-currency", code); } catch (e) {}
    window.__hkCur = curObj().sym;
  }
  window.__hkCur = curObj().sym;
  var hkCelebAt = 0;
  function celebrateIncome() {
    var now = Date.now();
    if (now - hkCelebAt < 800) return;
    hkCelebAt = now;
    if (!document.body) return;
    var ov = document.createElement("div");
    ov.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:99999;overflow:hidden;";
    function note(w, light) {
      var n = document.createElement("div");
      n.style.cssText = "position:absolute;bottom:-40px;width:" + w + "px;height:" + Math.round(w * 0.55) + "px;border-radius:5px;background:linear-gradient(135deg," + (light ? "#7BD4A6,#417245" : "#5FAE81,#316750") + ");box-shadow:0 6px 16px rgba(0,0,0,.30),inset 0 0 0 2px rgba(204,252,176,.45);display:flex;align-items:center;justify-content:center;color:#CCFCB0;font-weight:800;font-size:" + Math.round(w * 0.42) + "px;";
      n.textContent = "\u09F3";
      return n;
    }
    function coin(d) {
      var c = document.createElement("div");
      c.style.cssText = "position:absolute;bottom:-30px;width:" + d + "px;height:" + d + "px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fde68a,#f59e0b 65%,#b45309);box-shadow:0 4px 10px rgba(0,0,0,.30),inset 0 0 0 2px rgba(255,255,255,.35);";
      return c;
    }
    var W = window.innerWidth || 360;
    for (var i = 0; i < 26; i++) {
      var isCoin = i % 3 === 2;
      var p = isCoin ? coin(13 + Math.random() * 10) : note(40 + Math.random() * 26, i % 2 === 0);
      var x = W / 2 + (Math.random() - 0.5) * W * 0.55;
      p.style.left = x + "px";
      ov.appendChild(p);
      var dx = (Math.random() - 0.5) * 190;
      var dy = -(window.innerHeight * (0.55 + Math.random() * 0.45));
      var rot = (Math.random() - 0.5) * 340;
      var dur = 1500 + Math.random() * 1100;
      p.animate([
        { transform: "translate(0,0) rotate(0deg)", opacity: 1 },
        { transform: "translate(" + dx * 0.7 + "px," + dy * 0.75 + "px) rotate(" + rot * 0.7 + "deg)", opacity: 1, offset: 0.72 },
        { transform: "translate(" + dx + "px," + dy + "px) rotate(" + rot + "deg)", opacity: 0 }
      ], { duration: dur, delay: Math.random() * 260, easing: "cubic-bezier(.17,.67,.35,1)", fill: "forwards" });
    }
    document.body.appendChild(ov);
    setTimeout(function () { ov.remove(); }, 3100);
  }
  window.__hkCelebrate = celebrateIncome;
  window.addEventListener("hk-income", celebrateIncome);
  function injectSettingsCard() {
    var existing = document.getElementById("hk-settings-card");
    if (!moreMounted()) { if (existing) existing.remove(); return; }
    if (existing && existing.getAttribute("data-hk-lang") !== donateLang()) { existing.remove(); existing = null; }
    if (existing) return;
    var S = STR[donateLang()];
    var wrap = el("div", "width:100%;box-sizing:border-box;margin-top:20px;");
    wrap.id = "hk-settings-card";
    wrap.setAttribute("data-hk-lang", donateLang());
    var head = el("div", "display:flex;align-items:center;gap:10px;");
    var tile = el("div", "width:34px;height:34px;border-radius:10px;background:#7c3aed;color:#fff;display:flex;align-items:center;justify-content:center;flex:0 0 auto;");
    tile.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="4" y1="7" x2="20" y2="7"/><circle cx="9" cy="7" r="2.2" fill="#7c3aed" stroke="none"/><line x1="4" y1="17" x2="20" y2="17"/><circle cx="15" cy="17" r="2.2" fill="#7c3aed" stroke="none"/></svg>';
    head.appendChild(tile);
    head.appendChild(el("div", "font-size:17px;font-weight:800;", S.settingsHead));
    wrap.appendChild(head);
    var card = el("div", "margin-top:10px;border-radius:16px;background:var(--surface,#ffffff);border:1px solid var(--border,rgba(128,128,128,.25));box-shadow:0 4px 14px rgba(0,0,0,.06);padding:2px 14px;position:relative;");
    var lrow = el("div", "display:flex;align-items:center;gap:12px;padding:12px 0;cursor:pointer;");
    var ltile = el("div", "width:40px;height:40px;border-radius:12px;background:rgba(34,211,238,.18);color:#0891b2;display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:800;flex:0 0 auto;", "\u6587A");
    lrow.appendChild(ltile);
    lrow.appendChild(el("div", "flex:1;font-size:15px;font-weight:600;text-align:left;", S.languageLbl));
    lrow.appendChild(el("div", "color:#0D9488;font-size:14.5px;font-weight:700;", (donateLang() === "en" ? "English" : "\u09AC\u09BE\u0982\u09B2\u09BE") + " \u25BE"));
    card.appendChild(lrow);
    var pop = el("div", "display:none;position:absolute;right:12px;top:58px;z-index:40;background:var(--surface,#ffffff);border:1px solid var(--border,rgba(128,128,128,.35));border-radius:12px;box-shadow:0 12px 30px rgba(0,0,0,.25);overflow:hidden;min-width:160px;");
    function langOpt(label, code) {
      var o = el("div", "padding:11px 14px;font-size:14.5px;font-weight:600;cursor:pointer;display:flex;justify-content:space-between;gap:14px;", label);
      if (donateLang() === code) o.appendChild(el("span", "color:#0D9488;font-weight:800;", "\u2713"));
      o.onclick = function (ev) { ev.stopPropagation(); pop.style.display = "none"; applyLang(code); };
      return o;
    }
    pop.appendChild(langOpt("\u09AC\u09BE\u0982\u09B2\u09BE", "bn"));
    pop.appendChild(langOpt("English", "en"));
    card.appendChild(pop);
    lrow.onclick = function (ev) { ev.stopPropagation(); pop.style.display = pop.style.display === "none" ? "block" : "none"; };
    document.addEventListener("click", function () { pop.style.display = "none"; });
    var trow = el("div", "display:flex;align-items:center;gap:12px;padding:12px 0;border-top:1px solid rgba(128,128,128,.18);");
    var ttile = el("div", "width:40px;height:40px;border-radius:12px;background:rgba(168,85,247,.16);color:#9333ea;display:flex;align-items:center;justify-content:center;flex:0 0 auto;");
    ttile.innerHTML = '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22a10 10 0 1 1 10-10c0 2.2-1.8 3-3.5 3H17a2 2 0 0 0-1.6 3.3c.4.5.6 1 .6 1.5 0 1.2-1 2.2-2.5 2.2Z"/><circle cx="7.5" cy="10.5" r="1.1" fill="currentColor" stroke="none"/><circle cx="12" cy="7.5" r="1.1" fill="currentColor" stroke="none"/><circle cx="17" cy="10.5" r="1.1" fill="currentColor" stroke="none"/></svg>';
    trow.appendChild(ttile);
    trow.appendChild(el("div", "flex:1;font-size:15px;font-weight:600;text-align:left;", S.themeLbl));
    var seg = el("div", "display:flex;gap:2px;background:rgba(128,128,128,.16);border-radius:999px;padding:3px;");
    var segBtns = {};
    function paintSeg(force) {
      var active = force;
      if (!active) { active = curTheme(); }
      for (var k in segBtns) {
        var on = k === active;
        segBtns[k].style.background = on ? "#0D9488" : "transparent";
        segBtns[k].style.color = on ? "#ffffff" : "inherit";
        segBtns[k].style.opacity = on ? "1" : ".65";
      }
    }
    function segBtn(key, inner, fn) {
      var b = el("button", "width:42px;height:30px;border:0;border-radius:999px;background:transparent;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:800;padding:0;");
      b.type = "button";
      if (inner) b.innerHTML = inner;
      b.onclick = function (ev) { ev.stopPropagation(); fn(); paintSeg(key); };
      segBtns[key] = b;
      seg.appendChild(b);
      return b;
    }
    segBtn("light", '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>', function () { setThemeMode("light"); applyTheme("light"); });
    segBtn("dark", '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>', function () { setThemeMode("dark"); applyTheme("dark"); });
    trow.appendChild(seg);
    card.appendChild(trow);
    paintSeg();
    var crow = el("div", "display:flex;align-items:center;gap:12px;padding:12px 0;border-top:1px solid rgba(128,128,128,.18);cursor:pointer;");
    var co0 = curObj();
    var symTrim = co0.sym.replace(/\s+$/, "");
    var ctileFs = symTrim.length > 2 ? "11px" : (symTrim.length > 1 ? "14px" : "19px");
    crow.appendChild(el("div", "width:40px;height:40px;border-radius:12px;background:rgba(59,130,246,.15);color:#2563eb;display:flex;align-items:center;justify-content:center;font-weight:800;flex:0 0 auto;font-size:" + ctileFs + ";", symTrim));
    crow.appendChild(el("div", "flex:1;font-size:15px;font-weight:600;text-align:left;", S.currencyLbl));
    crow.appendChild(el("div", "color:#0D9488;font-size:14.5px;font-weight:700;", co0.code + " \u25BE"));
    card.appendChild(crow);
    var cpop = el("div", "display:none;position:absolute;right:12px;top:196px;z-index:40;background:var(--surface,#ffffff);border:1px solid var(--border,rgba(128,128,128,.35));border-radius:12px;box-shadow:0 12px 30px rgba(0,0,0,.25);overflow-y:auto;max-height:264px;min-width:210px;");
    CURS.forEach(function (cu) {
      var o = el("div", "padding:11px 14px;font-size:14.5px;font-weight:600;cursor:pointer;display:flex;justify-content:space-between;gap:14px;", cu.sym.replace(/\s+$/, "") + "  " + cu.code + " \u00B7 " + (donateLang() === "bn" ? cu.bn : cu.en));
      if (co0.code === cu.code) o.appendChild(el("span", "color:#0D9488;font-weight:800;", "\u2713"));
      o.onclick = function (ev) { ev.stopPropagation(); cpop.style.display = "none"; if (cu.code !== co0.code) { setCur(cu.code); location.reload(); } };
      cpop.appendChild(o);
    });
    card.appendChild(cpop);
    crow.onclick = function (ev) { ev.stopPropagation(); cpop.style.display = cpop.style.display === "none" ? "block" : "none"; };
    document.addEventListener("click", function () { cpop.style.display = "none"; });
    wrap.appendChild(card);
    var bk = backupCardEl();
    var mainEl = document.querySelector("main");
    if (bk && bk.parentElement && mainEl && mainEl.contains(bk)) { bk.parentElement.insertBefore(wrap, bk); return; }
    var dn = document.getElementById("hk-donate-card");
    if (dn && dn.parentElement) { dn.parentElement.insertBefore(wrap, dn); return; }
    var ac2 = document.getElementById("hk-account-box");
    if (ac2 && ac2.parentElement) { ac2.parentElement.insertBefore(wrap, ac2); return; }
    var w2 = creditWrapperEl();
    if (w2 && w2.parentElement) w2.parentElement.insertBefore(wrap, w2);
  }

  /* ---------------- about + footer (More page) ---------------- */
  var AQ_MONO = "data:image/webp;base64,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";
  var AQ_LOCK = "data:image/webp;base64,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";
  window.__hkAq = AQ_MONO;
  function creditWrapperEl() {
    var fb = fbPill();
    if (!fb) return null;
    var norm = function (x) { return (x || "").replace(/\u09AF\u09BC/g, "\u09DF").replace(/\u09A1\u09BC/g, "\u09DC").replace(/\u09A2\u09BC/g, "\u09DD"); };
    var needle = "\u09AC\u09BE\u09A8\u09BF\u09DF\u09C7\u099B\u09C7\u09A8";
    var w = fb, hops = 0;
    while (w && hops < 6) {
      if (w.parentElement && (norm(w.textContent).indexOf(needle) >= 0 || (w.textContent || "").toLowerCase().indexOf("made by") >= 0) && (w.textContent || "").length < 400) return w;
      w = w.parentElement; hops++;
    }
    return null;
  }
  function openAboutPage() {
    var old = document.getElementById("hk-about-page");
    if (old) { old.style.display = "block"; return; }
    var S = STR[donateLang()];
    var th = "light";
    try { if (document.documentElement.dataset.theme === "dark") th = "dark"; } catch (e) {}
    var P = THEMES[th];
    var page = el("div", "position:fixed;inset:0;z-index:9998;overflow-y:auto;background:linear-gradient(160deg,#0D9488 0%,#0a7268 55%,#316750 100%);padding:18px;box-sizing:border-box;");
    page.id = "hk-about-page";
    var back = el("button", "background:rgba(255,255,255,.18);border:0;color:#fff;font-size:15px;font-weight:700;padding:9px 16px;border-radius:999px;cursor:pointer;", S.backBtn);
    back.onclick = function () { page.style.display = "none"; };
    page.appendChild(back);
    var card = el("div", "max-width:430px;margin:16px auto 0;" + P.card + "border-radius:20px;padding:24px 18px;box-sizing:border-box;box-shadow:0 18px 50px rgba(0,0,0,.35);text-align:center;");
    var logoImg = el("img", "width:64px;height:64px;border-radius:50%;object-fit:cover;display:block;margin:0 auto;");
    logoImg.src = LOGO; logoImg.alt = "";
    card.appendChild(logoImg);
    var nm = el("div", "font-size:21px;font-weight:800;color:" + P.title + ";margin-top:8px;");
    nm.appendChild(document.createTextNode(donateLang() === "en" ? "Hisab Koi" : "\u09B9\u09BF\u09B8\u09BE\u09AC \u0995\u0987"));
    var bang = el("span", "color:#e11d2e;", "!");
    nm.appendChild(bang);
    card.appendChild(nm);
    card.appendChild(el("div", "font-size:12.5px;color:" + P.sub + ";margin-top:2px;", S.versionLbl + " 1.9.11"));
    card.appendChild(el("div", "font-size:14px;line-height:1.65;color:" + P.sub + ";margin-top:12px;", S.aboutText));
    var lockWrap = el("div", "margin-top:18px;border-radius:14px;padding:14px 10px;background:" + (th === "dark" ? "#ffffff" : "transparent") + ";");
    var lockImg = el("img", "width:210px;max-width:80%;height:auto;display:block;margin:0 auto;");
    lockImg.src = AQ_LOCK; lockImg.alt = "AURYQEN";
    lockWrap.appendChild(lockImg);
    card.appendChild(lockWrap);
    card.appendChild(el("div", "font-size:13px;font-weight:700;color:" + P.title + ";margin-top:18px;", S.contact));
    var soc = el("div", "display:flex;gap:8px;justify-content:center;margin-top:10px;flex-wrap:wrap;");
    function socBtn(label, bg, href) {
      var b = el("a", "display:inline-block;padding:9px 16px;border-radius:999px;background:" + bg + ";color:#fff;font-size:13.5px;font-weight:700;text-decoration:none;", label);
      b.href = href; b.target = "_blank"; b.rel = "noopener";
      return b;
    }
    soc.appendChild(socBtn("Facebook", "#1877F2", "https://www.facebook.com/iamskrfarhad007"));
    soc.appendChild(socBtn("WhatsApp", "#25D366", "https://wa.me/8801793333224"));
    soc.appendChild(socBtn("Instagram", "#C13584", "https://www.Instagram.com/iam_skrfarhad"));
    card.appendChild(soc);
    page.appendChild(card);
    document.body.appendChild(page);
  }
  function injectAboutBlock() {
    var existing = document.getElementById("hk-about-block");
    if (!moreMounted()) { if (existing) existing.remove(); return; }
    if (existing && existing.getAttribute("data-hk-lang") !== donateLang()) { existing.remove(); existing = null; }
    var w = creditWrapperEl();
    if (!w || !w.parentElement) return;
    w.style.display = "none";
    if (existing) return;
    var S = STR[donateLang()];
    var block = el("div", "width:100%;box-sizing:border-box;margin-top:20px;");
    block.id = "hk-about-block";
    block.setAttribute("data-hk-lang", donateLang());
    var rowCard = el("div", "margin-top:0;padding:13px 14px;border-radius:14px;background:rgba(13,148,136,.10);border:1px solid rgba(13,148,136,.30);cursor:pointer;");
    var rrow = el("div", "display:flex;align-items:center;gap:12px;");
    var aimg = el("img", "width:46px;height:46px;border-radius:50%;object-fit:cover;flex:0 0 auto;");
    aimg.src = LOGO; aimg.alt = "";
    rrow.appendChild(aimg);
    var atx = el("div", "flex:1;text-align:left;");
    atx.appendChild(el("div", "font-size:15px;font-weight:800;", S.aboutTitle));
    atx.appendChild(el("div", "font-size:12.5px;opacity:.75;margin-top:2px;", S.aboutSub));
    rrow.appendChild(atx);
    rrow.appendChild(el("div", "font-size:22px;opacity:.55;", "\u203A"));
    rowCard.appendChild(rrow);
    rowCard.onclick = openAboutPage;
    block.appendChild(rowCard);
    w.parentElement.insertBefore(block, w);
  }

  function injectFooterBlock() {
    var existing = document.getElementById("hk-footer-block");
    if (!moreMounted()) { if (existing) existing.remove(); return; }
    if (existing && existing.getAttribute("data-hk-lang") !== donateLang()) { existing.remove(); existing = null; }
    if (existing) return;
    var w = creditWrapperEl();
    if (!w || !w.parentElement) return;
    var S = STR[donateLang()];
    var foot = el("div", "width:100%;box-sizing:border-box;margin-top:24px;text-align:center;");
    foot.id = "hk-footer-block";
    foot.setAttribute("data-hk-lang", donateLang());
    var l1 = el("div", "display:flex;align-items:center;justify-content:center;gap:8px;");
    var fimg = el("img", "width:30px;height:30px;border-radius:50%;object-fit:cover;");
    fimg.src = LOGO; fimg.alt = "";
    l1.appendChild(fimg);
    var fnm = el("span", "font-size:19px;font-weight:800;");
    fnm.appendChild(document.createTextNode(donateLang() === "en" ? "Hisab Koi" : "\u09B9\u09BF\u09B8\u09BE\u09AC \u0995\u0987"));
    fnm.appendChild(el("span", "color:#e11d2e;", "!"));
    l1.appendChild(fnm);
    foot.appendChild(l1);
    foot.appendChild(el("div", "font-size:12.5px;opacity:.65;margin-top:5px;", S.versionLbl + " 1.9.11"));
    var l3 = el("div", "display:flex;align-items:center;justify-content:center;gap:7px;margin-top:10px;");
    l3.appendChild(el("span", "font-size:13px;opacity:.8;", S.productBy));
    var mimg = el("img", "height:18px;width:auto;display:block;");
    mimg.className = "hk-aq-mono";
    mimg.src = AQ_MONO; mimg.alt = "";
    l3.appendChild(mimg);
    l3.appendChild(el("span", "font-size:14.5px;font-weight:800;letter-spacing:.4px;", "AURYQEN"));
    foot.appendChild(l3);
    w.parentElement.insertBefore(foot, w);
  }
  function backupCardEl() {
    var secs = document.querySelectorAll("section[aria-label]");
    for (var si = 0; si < secs.length; si++) {
      var al = secs[si].getAttribute("aria-label") || "";
      if (al === "\u09AC\u09CD\u09AF\u09BE\u0995\u0986\u09AA \u09AB\u09BE\u0987\u09B2" || al.toLowerCase() === "backup file") return secs[si];
    }
    var all = document.querySelectorAll("button,a,div,span,p");
    var btn = null;
    for (var i = 0; i < all.length; i++) {
      var t = all[i].textContent || "";
      if ((t.indexOf("\u09AC\u09CD\u09AF\u09BE\u0995\u0986\u09AA \u09A1\u09BE\u0989\u09A8\u09B2\u09CB\u09A1") >= 0 || t.toLowerCase().indexOf("download backup") >= 0) && (!btn || t.length < (btn.textContent || "").length)) btn = all[i];
    }
    if (!btn) return null;
    function isTitle(x) { return x.indexOf("\u09AC\u09CD\u09AF\u09BE\u0995\u0986\u09AA \u09AB\u09BE\u0987\u09B2") >= 0 || x.toLowerCase().indexOf("backup file") >= 0; }
    var card = btn, root = null, h = 0;
    while (card && h < 6 && (card.textContent || "").length < 1400) {
      if (isTitle(card.textContent || "")) root = card;
      card = card.parentElement; h++;
    }
    if (root) return root;
    var all2 = document.querySelectorAll("div,section");
    var best = null;
    for (var i2 = 0; i2 < all2.length; i2++) {
      var t2 = all2[i2].textContent || "";
      if (t2.length > 200 && t2.length < 4000 && isTitle(t2) && (t2.indexOf("\u09AC\u09CD\u09AF\u09BE\u0995\u0986\u09AA \u09A1\u09BE\u0989\u09A8\u09B2\u09CB\u09A1") >= 0 || t2.toLowerCase().indexOf("download backup") >= 0)) {
        if (!best || t2.length < (best.textContent || "").length) best = all2[i2];
      }
    }
    return best;
  }
  function pinMoreOrder() {
    var w = creditWrapperEl();
    if (!w || !w.parentElement) return;
    var parent = w.parentElement;
    var rescueIds = ["hk-account-box", "hk-donate-card", "hk-about-block", "hk-footer-block", "hk-settings-card"];
    for (var ri = 0; ri < rescueIds.length; ri++) {
      var rb = document.getElementById(rescueIds[ri]);
      if (rb && w.contains(rb)) parent.insertBefore(rb, w);
    }
    var foot = document.getElementById("hk-footer-block");
    var sup = document.getElementById("hk-donate-card");
    var ab = document.getElementById("hk-about-block");
    if (foot && foot.parentElement === parent && foot.nextSibling !== w) parent.insertBefore(foot, w);
    if (sup && sup.parentElement === parent) {
      var ref = (foot && foot.parentElement === parent) ? foot : w;
      if (sup.nextSibling !== ref) parent.insertBefore(sup, ref);
    }
    if (ab && ab.parentElement === parent) {
      var ref2 = (sup && sup.parentElement === parent) ? sup : ((foot && foot.parentElement === parent) ? foot : w);
      if (ab.nextSibling !== ref2) parent.insertBefore(ab, ref2);
    }
    var st = document.getElementById("hk-settings-card");
    var ac = document.getElementById("hk-account-box");
    var bk2 = backupCardEl();
    var mainEl2 = document.querySelector("main");
    if (bk2 && bk2.parentElement && mainEl2 && mainEl2.contains(bk2)) {
      if (ac && ac.nextSibling !== bk2) bk2.parentElement.insertBefore(ac, bk2);
      if (st && st.nextSibling !== (ac || bk2)) bk2.parentElement.insertBefore(st, ac || bk2);
    } else if (ac && st && st.parentElement && ac.previousSibling !== st) {
      st.parentElement.insertBefore(ac, st.nextSibling);
    }
  }

  /* ---------------- dark-mode fix: pale balance card ---------------- */
  var balStyleDone = false;
  function fixBalCard() {
    if (!balStyleDone) {
      balStyleDone = true;
      var st = document.createElement("style");
      st.textContent = "[data-theme=\"dark\"] .hk-bal-dark{background:linear-gradient(135deg,#0F766E 0%,#0D9488 55%,#0A7268 100%) !important;}" +
        "[data-theme=\"dark\"] .hk-bal-dark p{color:#FFFFFF !important;}" +
        "[data-theme=\"dark\"] .hk-bal-dark p span{background:rgba(255,255,255,.25) !important;}" +
        "[data-theme=\"dark\"] .hk-bal-dark>div[aria-hidden=\"true\"]{background:rgba(255,255,255,.08) !important;}" +
        "[data-theme=\"dark\"] .hk-aq-mono{background:#FFFFFF;border-radius:5px;padding:2px 5px;}";
      (document.head || document.documentElement).appendChild(st);
    }
    var divs = document.querySelectorAll("div");
    for (var i = 0; i < divs.length; i++) {
      var d = divs[i];
      if (d.classList && d.classList.contains("hk-bal-dark")) continue;
      var bg = d.style && d.style.background;
      if (bg && bg.indexOf("204, 251, 241") >= 0) d.classList.add("hk-bal-dark");
    }
  }

  /* ---------------- auth state ---------------- */
  auth.onAuthStateChanged(function (user) {
    currentUser = user || null;
    if (user) {
      hideOverlay();
      sessionStorage.removeItem("hk-applied");
      var hasLocal = false;
      try { hasLocal = !!window.localStorage.getItem(KEY); } catch (e) {}
      if (!hasLocal) showSyncing();
      syncOnLogin();
      injectAccountBox();
    } else {
      hideSyncing();
      var skipped = false;
      try { skipped = sessionStorage.getItem(SKIP) === "1"; } catch (e) {}
      if (!skipped) showOverlay();
    }
  });
  if (window.MutationObserver) {
    var mo = new MutationObserver(function () { injectAccountBox(); injectDonateCard(); injectAboutBlock(); injectFooterBlock(); injectSettingsCard(); pinMoreOrder(); fixBalCard(); });
    document.addEventListener("DOMContentLoaded", function () {
      if (document.body) { mo.observe(document.body, { childList: true, subtree: true }); injectDonateCard(); injectAboutBlock(); injectFooterBlock(); injectSettingsCard(); pinMoreOrder(); fixBalCard(); }
    });
  }
})();
