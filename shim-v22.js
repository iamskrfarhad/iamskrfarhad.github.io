/* Hisab Koi! — offline actions shim (APK build)
 *
 * The web app talks to its server only through POST ./actions
 * {action, args, actionCallId} -> {data} | {error}.
 * This shim intercepts those calls in the Android WebView and answers them
 * from a localStorage database, re-implementing the server actions
 * (server/src/actions.ts) with the same validation messages and the same
 * getState shape. Amounts are numbers everywhere (the server's num()
 * guard): text-stored amounts are coerced to 0 instead of producing NaN
 * totals. Since v8 the seed is EMPTY: a brand-new install starts with no
 * wallets, transactions, budgets or notes at all, and the user creates
 * their own wallets first. Data lives only on the phone — it does NOT
 * sync with the Muse-hosted web app. An update install never wipes
 * data: load() only seeds when no stored database exists at all, and
 * old databases are migrated (directions dilam/nilam -> gave/took and
 * borrow/lend, missing wallet_id/tx_id/price fields filled in).
 *
 * v10: adds moveGoalMoney (সঞ্চয় page deposits/withdrawals — was missing
 * from the v9 shim, so savings moves would have failed offline), and the
 * www snapshot is the live build with the Report-page consolidation.
 *
 * v11: sub-categories (two-level picker) — transactions carry a
 * `subcategories` array index-aligned with `categories` (server rules in
 * server/src/actions.ts: normalize/parse mirror parseCategories);
 * add/edit/getState/importBackup preserve it, and old backups without
 * the field restore with main-only categories (all "").
 *
 * v12: social links (More-tab credit pills) — the client no longer
 * hardcodes Facebook/WhatsApp/Instagram; getState returns
 * `social_links` {facebook, whatsapp, instagram} from app_settings,
 * and a new `setSocialLinks` action stores them. The shim seeds the
 * owner's own links (the ones he gave on 2026-11-14) so a fresh APK
 * install still shows the pills, and importBackup v8 carries them
 * (older backups without the field keep the current links).
 *
 * v9: business entries and bazar items keep linked wallet transactions
 * in sync, exactly like the server (gave = expense, took = income;
 * bazar item bought = expense from the list's wallet), and importBackup
 * accepts the flat payload the client actually sends (with tx ids and
 * tx_ref links remapped).
 */
(function () {
  "use strict";
  document.title = "Hisab Koi!";

  var KEY = "hisabkoi-offline-v1";

  /* The owner's own social links (he gave them 2026-11-14 for the
   * More-tab pills, and they are the links the live web app serves
   * from app_settings). Seeded so a fresh APK install still shows the
   * pills, exactly as the hardcoded links did through v18. */
  var SOCIAL_LINKS_DEFAULT = {
    facebook: "https://www.facebook.com/iamskrfarhad007",
    whatsapp: "https://wa.me/8801793333224",
    instagram: "https://www.Instagram.com/iam_skrfarhad"
  };
  function cleanSocialLink(v) {
    return typeof v === "string" ? v.trim().slice(0, 300) : "";
  }
  function cleanSocialLinks(v) {
    if (!v || typeof v !== "object" || Array.isArray(v)) return { facebook: "", whatsapp: "", instagram: "" };
    return {
      facebook: cleanSocialLink(v.facebook),
      whatsapp: cleanSocialLink(v.whatsapp),
      instagram: cleanSocialLink(v.instagram)
    };
  }
  function defaultSocialLinks() {
    return {
      facebook: SOCIAL_LINKS_DEFAULT.facebook,
      whatsapp: SOCIAL_LINKS_DEFAULT.whatsapp,
      instagram: SOCIAL_LINKS_DEFAULT.instagram
    };
  }

  /* Seed (v8/v9): EMPTY on purpose. A fresh install must show a completely
   * empty app — no wallets, no transactions, no budgets, no notes — so a
   * new user starts clean and creates their own wallets. Existing data
   * is never reseeded: load() below only uses SEED when localStorage has
   * no stored database at all. */
  var SEED = {
    version: 1,
    next: { wallet: 1, transaction: 1, task: 1, loan: 1, bazarList: 1, bazarItem: 1, goal: 1, business: 1, businessEntry: 1, budget: 1, note: 1 },
    wallets: [],
    transactions: [],
    tasks: [],
    loans: [],
    bazar_lists: [],
    goals: [],
    businesses: [],
    budgets: [],
    notes: [],
    social_links: defaultSocialLinks()
  };

  /* Server's num(): amounts can come back as text when an older build or
   * a restored backup stored them that way ("20" instead of 20).
   * Arithmetic on those produced the NaN totals the user saw. */
  function num(v) {
    var n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  function bumpNext(db) {
    var max = {};
    function scan(arr, key) {
      if (!Array.isArray(arr)) return;
      arr.forEach(function (r) {
        var id = Number(r && r.id);
        if (Number.isInteger(id)) max[key] = Math.max(max[key] || 0, id);
      });
    }
    scan(db.wallets, "wallet");
    scan(db.transactions, "transaction");
    scan(db.tasks, "task");
    scan(db.loans, "loan");
    scan(db.bazar_lists, "bazarList");
    (db.bazar_lists || []).forEach(function (l) { scan(l.items || [], "bazarItem"); });
    scan(db.goals, "goal");
    scan(db.businesses, "business");
    (db.businesses || []).forEach(function (b) { scan(b.entries || [], "businessEntry"); });
    scan(db.budgets, "budget");
    scan(db.notes, "note");
    if (!db.next || typeof db.next !== "object") db.next = {};
    var keys = ["wallet", "transaction", "task", "loan", "bazarList", "bazarItem", "goal", "business", "businessEntry", "budget", "note"];
    keys.forEach(function (k) {
      var cur = Number(db.next[k]);
      if (!Number.isInteger(cur) || cur <= (max[k] || 0)) db.next[k] = (max[k] || 0) + 1;
    });
  }

  /* Migrate pre-v9 databases: old shim stored loan/business directions
   * as dilam/nilam and had no wallet_id/tx_id on business entries, no
   * wallet_id on bazar lists and no price/tx_id on bazar items. Convert
   * them to the server's shapes so the client reads real totals. */
  function normalizeLegacy(db) {
    var arrs = ["wallets", "transactions", "tasks", "loans", "bazar_lists", "goals", "businesses", "budgets", "notes"];
    arrs.forEach(function (k) { if (!Array.isArray(db[k])) db[k] = []; });
    if (!db.social_links || typeof db.social_links !== "object" || Array.isArray(db.social_links)) db.social_links = defaultSocialLinks();
    else db.social_links = cleanSocialLinks(db.social_links);
    db.wallets.forEach(function (w) { w.opening_balance = num(w.opening_balance); });
    db.transactions.forEach(function (t) { t.amount = num(t.amount); if (!t.category) t.category = "অন্যান্য"; t.categories = parseCategories(t.categories, t.category); t.subcategories = parseSubcategories(t.subcategories, t.categories); });
    db.loans.forEach(function (l) {
      l.amount = num(l.amount);
      if (l.direction === "dilam") l.direction = "borrow";
      else if (l.direction === "nilam") l.direction = "lend";
      if (l.direction !== "borrow" && l.direction !== "lend") l.direction = "borrow";
    });
    db.goals.forEach(function (g) { g.saved = num(g.saved); g.target = num(g.target); g.type = cleanGoalType(g.type); });
    db.budgets.forEach(function (b) { b.amount = num(b.amount); });
    db.businesses.forEach(function (b) {
      (b.entries || []).forEach(function (e) {
        e.amount = num(e.amount);
        if (e.direction === "dilam") e.direction = "gave";
        else if (e.direction === "nilam") e.direction = "took";
        if (e.direction !== "gave" && e.direction !== "took") e.direction = "gave";
        if (e.wallet_id == null) e.wallet_id = null;
        if (e.tx_id == null) e.tx_id = null;
      });
    });
    db.bazar_lists.forEach(function (l) {
      if (l.wallet_id == null) l.wallet_id = null;
      (l.items || []).forEach(function (it) {
        it.price = num(it.price);
        if (it.tx_id == null) it.tx_id = null;
      });
    });
    bumpNext(db);
  }

  function load() {
    try {
      var raw = window.localStorage.getItem(KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && parsed.version === 1 && Array.isArray(parsed.wallets)) {
          normalizeLegacy(parsed);
          return parsed;
        }
      }
    } catch (e) { /* corrupted storage: reseed */ }
    var s = JSON.parse(JSON.stringify(SEED));
    save(s);
    return s;
  }
  function save(db) {
    try { window.localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { /* storage full/blocked */ }
    try { if (window.__hkPush) window.__hkPush(JSON.stringify(db)); } catch (e) { /* sync layer absent */ }
  }
  var DB = load();

  /* ---------- helpers (mirror server/src/actions.ts) ---------- */
  function ymd(d) {
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function today() { return ymd(new Date()); }
  function round2(n) { return Math.round(n * 100) / 100; }
  function cleanStr(v, max) {
    if (typeof v !== "string") return "";
    return v.trim().slice(0, max || 120);
  }
  function cleanNote(v) { return cleanStr(v, 240); }
  function cleanDate(v) {
    return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : today();
  }
  function cleanTime(v) {
    return typeof v === "string" && /^\d{2}:\d{2}$/.test(v) ? v : "";
  }
  function cleanAmount(v) {
    var n = Number(v);
    if (!Number.isFinite(n) || n <= 0) throw new Error("সঠিক পরিমাণ দিন");
    return round2(n);
  }
  function cleanGoalType(v) { var T = ["ডিপিএস", "মাটির ব্যাংক", "লক্ষ্য", "অন্যান্য"]; return T.indexOf(v) >= 0 ? v : "লক্ষ্য"; }
  function cleanMoney(v) {
    var n = Number(v);
    return Number.isFinite(n) && n >= 0 ? round2(n) : 0;
  }
  function cleanKind(v) {
    return v === "bank" || v === "mobile" || v === "cash" || v === "other" ? v : "cash";
  }
  function cleanBizDir(v) { return v === "took" ? "took" : "gave"; }
  function cleanLoanDir(v) { return v === "lend" ? "lend" : "borrow"; }
  function bool(v) { return v === true; }
  // Multi-category (mirrors the server): trims, dedupes, and guarantees at
  // least the primary category is present. The first item is the primary
  // and is the only one category accounting ever reads.
  function normalizeCategories(cats, primary) {
    var list = [];
    if (Array.isArray(cats)) {
      cats.forEach(function (c) {
        if (typeof c === "string") { var t = c.trim(); if (t && list.indexOf(t) === -1) list.push(t); }
      });
    }
    return list.length > 0 ? list : [primary];
  }
  function parseCategories(raw, primary) {
    if (Array.isArray(raw)) return normalizeCategories(raw, primary);
    if (typeof raw === "string" && raw) {
      try { var parsed = JSON.parse(raw); if (Array.isArray(parsed)) return normalizeCategories(parsed, primary); } catch (e) { /* fall through */ }
    }
    return primary ? [primary] : [];
  }
  // Sub-categories ride alongside `categories`, index-aligned (server rules
  // in server/src/actions.ts): subcategories[i] is the sub-category of
  // categories[i], "" when that category has none. Rows written before
  // sub-category support have no subcategories field and read as all "".
  function normalizeSubcategories(subs, cats) {
    return cats.map(function (_, i) {
      var s = subs && subs[i];
      return typeof s === "string" ? s.trim() : "";
    });
  }
  function parseSubcategories(raw, cats) {
    var empty = cats.map(function () { return ""; });
    if (Array.isArray(raw)) return normalizeSubcategories(raw, cats);
    if (typeof raw === "string" && raw) {
      try { var parsed = JSON.parse(raw); if (Array.isArray(parsed)) return normalizeSubcategories(parsed, cats); } catch (e) { /* fall through */ }
    }
    return empty;
  }
  function find(arr, id) {
    for (var i = 0; i < arr.length; i++) if (arr[i].id === id) return arr[i];
    return null;
  }
  function walletName(id) {
    var w = find(DB.wallets, id);
    return w ? w.name : "";
  }
  function walletExists(id) { return !!find(DB.wallets, id); }
  function intId(v) {
    var n = Number(v);
    return Number.isInteger(n) && n > 0 ? n : null;
  }
  function isPlainObject(v) {
    return v !== null && typeof v === "object" && !Array.isArray(v);
  }
  function insertTx(tx) {
    var id = DB.next.transaction++;
    var cats = normalizeCategories(tx.categories, tx.category);
    DB.transactions.push({
      id: id, type: tx.type, amount: tx.amount, wallet_id: tx.walletId,
      category: tx.category, categories: cats,
      subcategories: normalizeSubcategories(tx.subcategories, cats),
      note: tx.note, date: tx.date, time: tx.time
    });
    return id;
  }
  function deleteTx(id) {
    DB.transactions = DB.transactions.filter(function (t) { return t.id !== id; });
  }
  function unlinkBizTx(txId) {
    DB.businesses.forEach(function (b) {
      (b.entries || []).forEach(function (e) {
        if (e.tx_id === txId) { e.tx_id = null; e.wallet_id = null; }
      });
    });
  }
  function unlinkBazarTx(txId) {
    DB.bazar_lists.forEach(function (l) {
      (l.items || []).forEach(function (it) {
        if (it.tx_id === txId) it.tx_id = null;
      });
    });
  }
  function findBizEntry(id) {
    var found = null;
    DB.businesses.forEach(function (b) {
      (b.entries || []).forEach(function (e) {
        if (e.id === id) found = { biz: b, entry: e };
      });
    });
    return found;
  }
  function findBazarItem(id) {
    var found = null;
    DB.bazar_lists.forEach(function (l) {
      (l.items || []).forEach(function (it) {
        if (it.id === id) found = { list: l, item: it };
      });
    });
    return found;
  }

  /* ---------- getState (same shape/order as the server) ---------- */
  function getState() {
    var balances = {};
    DB.wallets.forEach(function (w) { balances[w.id] = num(w.opening_balance); });
    var txs = DB.transactions.map(function (t) {
      var cats = parseCategories(t.categories, t.category);
      return {
        id: t.id, type: t.type, amount: num(t.amount), wallet_id: t.wallet_id,
        wallet_name: walletName(t.wallet_id) || "—", category: t.category,
        categories: cats,
        subcategories: parseSubcategories(t.subcategories, cats),
        note: t.note, date: t.date, time: t.time
      };
    });
    txs.forEach(function (t) {
      if (balances[t.wallet_id] !== undefined) {
        balances[t.wallet_id] += t.type === "income" ? num(t.amount) : -num(t.amount);
      }
    });
    txs.sort(function (a, b) {
      return a.date < b.date ? 1 : a.date > b.date ? -1 : b.id - a.id;
    });
    var wallets = DB.wallets.slice().sort(function (a, b) { return a.id - b.id; }).map(function (w) {
      return { id: w.id, name: w.name, kind: w.kind, opening_balance: num(w.opening_balance), balance: round2(balances[w.id] === undefined ? 0 : balances[w.id]) };
    });
    var tasks = DB.tasks.slice().sort(function (a, b) {
      return a.date < b.date ? -1 : a.date > b.date ? 1 : a.id - b.id;
    }).map(function (t) { return { id: t.id, title: t.title, date: t.date, done: !!t.done }; });
    var loans = DB.loans.slice().sort(function (a, b) {
      return a.date < b.date ? 1 : a.date > b.date ? -1 : b.id - a.id;
    }).map(function (l) {
      return { id: l.id, person: l.person, direction: l.direction, amount: num(l.amount), note: l.note, date: l.date, settled: !!l.settled, wallet_id: l.wallet_id != null ? l.wallet_id : null, paid: num(l.paid || 0), phone: l.phone || "" };
    });
    var bazarLists = DB.bazar_lists.slice().sort(function (a, b) {
      return a.date < b.date ? 1 : a.date > b.date ? -1 : b.id - a.id;
    }).map(function (l) {
      var items = (l.items || []).slice().sort(function (a, b) { return a.id - b.id; }).map(function (it) {
        return { id: it.id, name: it.name, qty: it.qty, price: num(it.price), done: !!it.done, tx_id: it.tx_id != null ? it.tx_id : null };
      });
      return { id: l.id, title: l.title, date: l.date, wallet_id: l.wallet_id != null ? l.wallet_id : null, wallet_name: l.wallet_id != null ? walletName(l.wallet_id) : "", items: items };
    });
    var goals = DB.goals.slice().sort(function (a, b) { return a.id - b.id; }).map(function (g) {
      return { id: g.id, name: g.name, saved: num(g.saved), target: num(g.target), type: cleanGoalType(g.type), created_date: g.created_date };
    });
    var budgets = (DB.budgets || []).slice().sort(function (a, b) {
      return a.month < b.month ? -1 : a.month > b.month ? 1 : a.id - b.id;
    }).map(function (b) {
      return { id: b.id, month: b.month, category: b.category, amount: num(b.amount) };
    });
    var notes = (DB.notes || []).slice().sort(function (a, b) {
      return a.date < b.date ? 1 : a.date > b.date ? -1 : b.id - a.id;
    }).map(function (n) {
      return { id: n.id, title: n.title, body: n.body, date: n.date };
    });
    var businesses = DB.businesses.slice().sort(function (a, b) { return a.id - b.id; }).map(function (b) {
      var entries = (b.entries || []).slice().sort(function (x, y) {
        return x.date < y.date ? 1 : x.date > y.date ? -1 : y.id - x.id;
      }).map(function (e) {
        return {
          id: e.id, direction: e.direction, amount: num(e.amount), note: e.note, date: e.date, time: e.time,
          wallet_id: e.wallet_id != null ? e.wallet_id : null,
          wallet_name: e.wallet_id != null ? walletName(e.wallet_id) : "",
          has_tx: e.tx_id != null, tx_id: e.tx_id != null ? e.tx_id : null
        };
      });
      var gave = 0, took = 0;
      entries.forEach(function (e) { if (e.direction === "gave") gave += num(e.amount); else took += num(e.amount); });
      return {
        id: b.id, name: b.name, note: b.note, entries: entries,
        total_gave: round2(gave), total_took: round2(took), net: round2(gave - took)
      };
    });
    return { wallets: wallets, transactions: txs, tasks: tasks, loans: loans, bazar_lists: bazarLists, goals: goals, businesses: businesses, budgets: budgets, notes: notes, social_links: cleanSocialLinks(DB.social_links) };
  }

  /* ---------- actions ---------- */
  var actions = {
    getState: function () { return getState(); },

    setSocialLinks: function (a) {
      DB.social_links = cleanSocialLinks(a);
      save(DB);
      return { ok: true };
    },

    addWallet: function (a) {
      var name = cleanStr(a.name, 60);
      if (!name) throw new Error("নাম দরকার");
      var id = DB.next.wallet++;
      DB.wallets.push({ id: id, name: name, kind: cleanKind(a.kind), opening_balance: cleanMoney(a.opening_balance) });
      save(DB);
      return { id: id };
    },
    updateWallet: function (a) {
      var w = find(DB.wallets, intId(a.id));
      if (!w) throw new Error("অ্যাকাউন্ট পাওয়া যায়নি");
      var name = cleanStr(a.name, 60);
      if (!name) throw new Error("নাম দরকার");
      w.name = name; w.kind = cleanKind(a.kind); w.opening_balance = cleanMoney(a.opening_balance);
      save(DB);
      return { ok: true };
    },
    deleteWallet: function (a) {
      var w = find(DB.wallets, intId(a.id));
      if (!w) throw new Error("অ্যাকাউন্ট পাওয়া যায়নি");
      if (DB.wallets.length <= 1) return { ok: false, error: "শেষ ওয়ালেটটি মোছা যাবে না।" };
      var walletTxIds = DB.transactions.filter(function (t) { return t.wallet_id === w.id; }).map(function (t) { return t.id; });
      DB.businesses.forEach(function (b) {
        (b.entries || []).forEach(function (e) {
          if (e.wallet_id === w.id || walletTxIds.indexOf(e.tx_id) !== -1) { e.wallet_id = null; e.tx_id = null; }
        });
      });
      DB.bazar_lists.forEach(function (l) {
        if (l.wallet_id === w.id) l.wallet_id = null;
        (l.items || []).forEach(function (it) {
          if (walletTxIds.indexOf(it.tx_id) !== -1) it.tx_id = null;
        });
      });
      DB.transactions = DB.transactions.filter(function (t) { return t.wallet_id !== w.id; });
      DB.wallets = DB.wallets.filter(function (x) { return x.id !== w.id; });
      save(DB);
      return { ok: true, error: null };
    },

    addTransaction: function (a) {
      var wallet = find(DB.wallets, intId(a.wallet_id));
      if (!wallet) throw new Error("অ্যাকাউন্ট পাওয়া যায়নি");
      var primary = cleanStr(a.category, 60) || "অন্যান্য";
      var cats = normalizeCategories(a.categories, primary);
      var id = DB.next.transaction++;
      DB.transactions.push({
        id: id, type: a.type === "income" ? "income" : "expense", amount: cleanAmount(a.amount),
        wallet_id: wallet.id, category: cats[0], categories: cats,
        subcategories: normalizeSubcategories(a.subcategories, cats),
        note: cleanNote(a.note), date: cleanDate(a.date), time: cleanTime(a.time)
      });
      save(DB);
      return { id: id };
    },
    updateTransaction: function (a) {
      var t = find(DB.transactions, intId(a.id));
      if (!t) throw new Error("লেনদেন পাওয়া যায়নি");
      var wallet = find(DB.wallets, intId(a.wallet_id));
      if (!wallet) throw new Error("অ্যাকাউন্ট পাওয়া যায়নি");
      var primary = cleanStr(a.category, 60) || "অন্যান্য";
      var cats = normalizeCategories(a.categories, primary);
      t.type = a.type === "income" ? "income" : "expense"; t.amount = cleanAmount(a.amount);
      t.wallet_id = wallet.id; t.category = cats[0]; t.categories = cats;
      t.subcategories = normalizeSubcategories(a.subcategories, cats);
      t.note = cleanNote(a.note); t.date = cleanDate(a.date); t.time = cleanTime(a.time);
      save(DB);
      return { ok: true };
    },
    deleteTransaction: function (a) {
      var t = find(DB.transactions, intId(a.id));
      if (!t) throw new Error("লেনদেন পাওয়া যায়নি");
      DB.businesses.forEach(function (b) { b.entries = (b.entries || []).filter(function (e) { return e.tx_id !== t.id; }); });
      unlinkBazarTx(t.id);
      DB.transactions = DB.transactions.filter(function (x) { return x.id !== t.id; });
      save(DB);
      return { ok: true };
    },

    transfer: function (a) {
      var fromId = intId(a.from_wallet_id), toId = intId(a.to_wallet_id);
      if (fromId === toId) return { ok: false, error: "একই ওয়ালেটে ট্রান্সফার করা যাবে না।" };
      var amount = cleanAmount(a.amount);
      var from = find(DB.wallets, fromId), to = find(DB.wallets, toId);
      if (!from || !to) return { ok: false, error: "ওয়ালেট পাওয়া যায়নি।" };
      var date = cleanDate(a.date), time = cleanTime(a.time);
      insertTx({ type: "expense", amount: amount, walletId: from.id, category: "ট্রান্সফার", note: "→ " + to.name, date: date, time: time });
      insertTx({ type: "income", amount: amount, walletId: to.id, category: "ট্রান্সফার", note: "← " + from.name, date: date, time: time });
      save(DB);
      return { ok: true, error: null };
    },

    addTask: function (a) {
      var title = cleanStr(a.title, 120);
      if (!title) throw new Error("কাজের নাম দরকার");
      var id = DB.next.task++;
      DB.tasks.push({ id: id, title: title, date: cleanDate(a.date), done: false });
      save(DB);
      return { id: id };
    },
    updateTask: function (a) {
      var t = find(DB.tasks, intId(a.id));
      if (!t) throw new Error("কাজ পাওয়া যায়নি");
      var title = cleanStr(a.title, 120);
      if (!title) throw new Error("কাজের নাম দরকার");
      t.title = title; t.date = cleanDate(a.date);
      save(DB);
      return { ok: true };
    },
    setTaskDone: function (a) {
      var t = find(DB.tasks, intId(a.id));
      if (!t) throw new Error("কাজ পাওয়া যায়নি");
      t.done = bool(a.done);
      save(DB);
      return { ok: true };
    },
    deleteTask: function (a) {
      var t = find(DB.tasks, intId(a.id));
      if (!t) throw new Error("কাজ পাওয়া যায়নি");
      DB.tasks = DB.tasks.filter(function (x) { return x.id !== t.id; });
      save(DB);
      return { ok: true };
    },

    addLoan: function (a) {
      var person = cleanStr(a.person, 60);
      if (!person) throw new Error("কার নাম দরকার");
      var wid = a.wallet_id != null ? intId(a.wallet_id) : null;
      var wallet = wid != null ? find(DB.wallets, wid) : null;
      var amount = cleanAmount(a.amount);
      var direction = cleanLoanDir(a.direction);
      var date = cleanDate(a.date);
      var id = DB.next.loan++;
      DB.loans.push({
        id: id, person: person, direction: direction,
        amount: amount, note: cleanNote(a.note),
        date: date, settled: false,
        wallet_id: wallet ? wallet.id : null, paid: 0, preexisting: a.preexisting === true, phone: cleanStr(a.phone, 24)
      });
      if (wallet && a.preexisting !== true) {
        insertTx({
          type: direction === "borrow" ? "income" : "expense",
          amount: amount, walletId: wallet.id, category: "ধার-দেনা",
          note: direction === "borrow" ? person + " থেকে ধার নেওয়া" : person + " কে ধার দেওয়া",
          date: date, time: ""
        });
      }
      save(DB);
      return { id: id };
    },
    updateLoan: function (a) {
      var l = find(DB.loans, intId(a.id));
      if (!l) throw new Error("ধার পাওয়া যায়নি");
      var person = cleanStr(a.person, 60);
      if (!person) throw new Error("কার নাম দরকার");
      l.person = person; l.direction = cleanLoanDir(a.direction);
      l.amount = cleanAmount(a.amount); l.note = cleanNote(a.note); l.date = cleanDate(a.date);
      l.phone = cleanStr(a.phone, 24);
      if (a.wallet_id !== undefined) {
        var uwid = a.wallet_id != null ? intId(a.wallet_id) : null;
        l.wallet_id = uwid != null && find(DB.wallets, uwid) ? uwid : null;
      }
      save(DB);
      return { ok: true };
    },
    setLoanSettled: function (a) {
      var l = find(DB.loans, intId(a.id));
      if (!l) throw new Error("ধার পাওয়া যায়নি");
      l.settled = bool(a.settled); if (l.settled) l.paid = num(l.amount); else l.paid = 0;
      save(DB);
      return { ok: true };
    },
    payLoan: function (a) {
      var l = find(DB.loans, intId(a.id));
      if (!l) throw new Error("ধার পাওয়া যায়নি");
      var remaining = round2(num(l.amount) - num(l.paid || 0));
      var amt = cleanAmount(a.amount);
      if (amt > remaining) amt = remaining;
      if (!(amt > 0)) throw new Error("পরিমাণ দিন");
      l.paid = round2(num(l.paid || 0) + amt);
      if (l.paid >= num(l.amount)) { l.paid = num(l.amount); l.settled = true; }
      var wid = a.wallet_id !== undefined && a.wallet_id !== null ? intId(a.wallet_id) : (l.wallet_id != null ? l.wallet_id : null);
      var wallet = wid != null ? find(DB.wallets, wid) : null;
      if (wallet) {
        insertTx({
          type: l.direction === "borrow" ? "expense" : "income",
          amount: amt, walletId: wallet.id, category: "ধার-দেনা",
          note: (l.direction === "borrow" ? "ধার শোধ — " : "ধার আদায় — ") + l.person,
          date: cleanDate(a.date), time: ""
        });
      }
      save(DB);
      return { ok: true };
    },
    deleteLoan: function (a) {
      var l = find(DB.loans, intId(a.id));
      if (!l) throw new Error("ধার পাওয়া যায়নি");
      DB.loans = DB.loans.filter(function (x) { return x.id !== l.id; });
      save(DB);
      return { ok: true };
    },

    addBazarList: function (a) {
      var title = cleanStr(a.title, 80);
      if (!title) throw new Error("তালিকার নাম দরকার");
      var wid = intId(a.wallet_id);
      var walletId = wid != null && walletExists(wid) ? wid : null;
      var id = DB.next.bazarList++;
      DB.bazar_lists.push({ id: id, title: title, date: cleanDate(a.date), wallet_id: walletId, items: [] });
      save(DB);
      return { id: id };
    },
    updateBazarList: function (a) {
      var l = find(DB.bazar_lists, intId(a.id));
      if (!l) throw new Error("তালিকা পাওয়া যায়নি");
      var title = cleanStr(a.title, 80);
      if (!title) throw new Error("তালিকার নাম দরকার");
      var wid = intId(a.wallet_id);
      l.title = title; l.date = cleanDate(a.date);
      l.wallet_id = wid != null && walletExists(wid) ? wid : null;
      save(DB);
      return { ok: true };
    },
    deleteBazarList: function (a) {
      var l = find(DB.bazar_lists, intId(a.id));
      if (!l) throw new Error("তালিকা পাওয়া যায়নি");
      var txIds = (l.items || []).map(function (it) { return it.tx_id; }).filter(function (x) { return x != null; });
      DB.bazar_lists = DB.bazar_lists.filter(function (x) { return x.id !== l.id; });
      txIds.forEach(function (txId) { deleteTx(txId); });
      save(DB);
      return { ok: true };
    },
    addBazarItem: function (a) {
      var l = find(DB.bazar_lists, intId(a.list_id));
      if (!l) throw new Error("তালিকা পাওয়া যায়নি");
      var name = cleanStr(a.name, 80);
      if (!name) throw new Error("জিনিসের নাম দরকার");
      var id = DB.next.bazarItem++;
      l.items.push({ id: id, name: name, qty: cleanStr(a.qty, 40), price: cleanMoney(a.price), done: false, tx_id: null });
      save(DB);
      return { id: id };
    },
    updateBazarItem: function (a) {
      var found = findBazarItem(intId(a.id));
      if (!found) throw new Error("জিনিস পাওয়া যায়নি");
      var name = cleanStr(a.name, 80);
      if (!name) throw new Error("জিনিসের নাম দরকার");
      var price = cleanMoney(a.price);
      found.item.name = name; found.item.qty = cleanStr(a.qty, 40); found.item.price = price;
      if (found.item.tx_id != null) {
        if (price > 0) {
          var tx = find(DB.transactions, found.item.tx_id);
          if (tx) {
            tx.amount = price;
            tx.note = name + " — " + found.list.title;
          }
        } else {
          var stale = found.item.tx_id;
          found.item.tx_id = null;
          deleteTx(stale);
        }
      }
      save(DB);
      return { ok: true };
    },
    setBazarItemDone: function (a) {
      var found = findBazarItem(intId(a.id));
      if (!found) throw new Error("জিনিস পাওয়া যায়নি");
      var item = found.item, list = found.list;
      var txId = item.tx_id != null ? item.tx_id : null;
      var staleTxId = null;
      if (txId != null && !find(DB.transactions, txId)) txId = null;
      if (bool(a.done)) {
        if (txId == null && list.wallet_id != null && num(item.price) > 0 && walletExists(list.wallet_id)) {
          txId = insertTx({
            type: "expense", amount: num(item.price), walletId: list.wallet_id,
            category: "বাজার", note: item.name + " — " + list.title,
            date: list.date, time: ""
          });
        }
      } else if (txId != null) {
        staleTxId = txId;
        txId = null;
      }
      item.done = bool(a.done);
      item.tx_id = txId;
      if (staleTxId != null) deleteTx(staleTxId);
      save(DB);
      return { ok: true };
    },
    deleteBazarItem: function (a) {
      var found = findBazarItem(intId(a.id));
      if (!found) throw new Error("জিনিস পাওয়া যায়নি");
      var txId = found.item.tx_id != null ? found.item.tx_id : null;
      found.list.items = (found.list.items || []).filter(function (it) { return it.id !== found.item.id; });
      if (txId != null) deleteTx(txId);
      save(DB);
      return { ok: true };
    },

    addGoal: function (a) {
      var name = cleanStr(a.name, 60);
      if (!name) throw new Error("লক্ষ্যের নাম দরকার");
      var id = DB.next.goal++;
      DB.goals.push({ id: id, name: name, saved: cleanMoney(a.saved), target: cleanAmount(a.target), type: cleanGoalType(a.type), created_date: today() });
      save(DB);
      return { id: id };
    },
    updateGoal: function (a) {
      var g = find(DB.goals, intId(a.id));
      if (!g) throw new Error("লক্ষ্য পাওয়া যায়নি");
      var name = cleanStr(a.name, 60);
      if (!name) throw new Error("লক্ষ্যের নাম দরকার");
      g.name = name; g.saved = cleanMoney(a.saved); g.target = cleanAmount(a.target); if (typeof a.type === "string") g.type = cleanGoalType(a.type);
      save(DB);
      return { ok: true };
    },
    deleteGoal: function (a) {
      var g = find(DB.goals, intId(a.id));
      if (!g) throw new Error("লক্ষ্য পাওয়া যায়নি");
      DB.goals = DB.goals.filter(function (x) { return x.id !== g.id; });
      save(DB);
      return { ok: true };
    },
    // v10: mirrors server moveGoalMoney — সঞ্চয় page deposit/withdraw.
    // A deposit posts an expense transaction (category সঞ্চয়) so the
    // wallet balance drops; a withdrawal posts an income transaction so
    // it rises. The goal's saved amount moves by the same amount,
    // clamped at 0, exactly like the server.
    moveGoalMoney: function (a) {
      var g = find(DB.goals, intId(a.goal_id));
      if (!g) throw new Error("লক্ষ্য পাওয়া যায়নি");
      var w = find(DB.wallets, intId(a.wallet_id));
      if (!w) throw new Error("অ্যাকাউন্ট পাওয়া যায়নি");
      var amount = cleanAmount(a.amount);
      var direction = a.direction === "withdraw" ? "withdraw" : "deposit";
      var signed = direction === "deposit" ? amount : -amount;
      g.saved = Math.max(0, num(g.saved) + signed);
      insertTx({
        type: direction === "deposit" ? "expense" : "income",
        amount: amount, walletId: w.id, category: "সঞ্চয়",
        note: g.name, date: cleanDate(a.date), time: cleanTime(a.time)
      });
      save(DB);
      return { ok: true };
    },

    addBudget: function (a) {
      var month = typeof a.month === "string" && /^\d{4}-\d{2}$/.test(a.month) ? a.month : null;
      if (!month) throw new Error("মাস সঠিক নয়");
      var category = cleanStr(a.category, 60);
      var amount = cleanAmount(a.amount);
      var dup = null;
      (DB.budgets || []).forEach(function (b) { if (b.month === month && b.category === category) dup = b; });
      if (dup) {
        dup.amount = amount;
        save(DB);
        return { id: dup.id };
      }
      var id = DB.next.budget++;
      DB.budgets.push({ id: id, month: month, category: category, amount: amount });
      save(DB);
      return { id: id };
    },
    updateBudget: function (a) {
      var b = find(DB.budgets, intId(a.id));
      if (!b) throw new Error("বাজেট পাওয়া যায়নি");
      b.amount = cleanAmount(a.amount);
      save(DB);
      return { ok: true };
    },
    deleteBudget: function (a) {
      var b = find(DB.budgets, intId(a.id));
      if (!b) throw new Error("বাজেট পাওয়া যায়নি");
      DB.budgets = DB.budgets.filter(function (x) { return x.id !== b.id; });
      save(DB);
      return { ok: true };
    },

    addNote: function (a) {
      var title = cleanStr(a.title, 120);
      if (!title) throw new Error("নোটের শিরোনাম দরকার");
      var id = DB.next.note++;
      DB.notes.push({ id: id, title: title, body: cleanStr(a.body, 4000), date: cleanDate(a.date) });
      save(DB);
      return { id: id };
    },
    updateNote: function (a) {
      var n = find(DB.notes, intId(a.id));
      if (!n) throw new Error("নোট পাওয়া যায়নি");
      var title = cleanStr(a.title, 120);
      if (!title) throw new Error("নোটের শিরোনাম দরকার");
      n.title = title; n.body = cleanStr(a.body, 4000); n.date = cleanDate(a.date);
      save(DB);
      return { ok: true };
    },
    deleteNote: function (a) {
      var n = find(DB.notes, intId(a.id));
      if (!n) throw new Error("নোট পাওয়া যায়নি");
      DB.notes = DB.notes.filter(function (x) { return x.id !== n.id; });
      save(DB);
      return { ok: true };
    },

    addBusiness: function (a) {
      var name = cleanStr(a.name, 80);
      if (!name) throw new Error("ব্যবসার নাম দরকার");
      var id = DB.next.business++;
      DB.businesses.push({ id: id, name: name, note: cleanNote(a.note), entries: [] });
      save(DB);
      return { id: id };
    },
    updateBusiness: function (a) {
      var b = find(DB.businesses, intId(a.id));
      if (!b) throw new Error("ব্যবসা পাওয়া যায়নি");
      var name = cleanStr(a.name, 80);
      if (!name) throw new Error("ব্যবসার নাম দরকার");
      b.name = name; b.note = cleanNote(a.note);
      save(DB);
      return { ok: true };
    },
    deleteBusiness: function (a) {
      var b = find(DB.businesses, intId(a.id));
      if (!b) throw new Error("ব্যবসা পাওয়া যায়নি");
      var txIds = (b.entries || []).map(function (e) { return e.tx_id; }).filter(function (x) { return x != null; });
      DB.businesses = DB.businesses.filter(function (x) { return x.id !== b.id; });
      txIds.forEach(function (txId) { deleteTx(txId); });
      save(DB);
      return { ok: true };
    },
    addBusinessEntry: function (a) {
      var b = find(DB.businesses, intId(a.business_id));
      if (!b) throw new Error("ব্যবসা পাওয়া যায়নি");
      var direction = cleanBizDir(a.direction);
      var amount = cleanAmount(a.amount);
      var note = cleanNote(a.note);
      if (note.indexOf(b.name + " — ") === 0) note = note.slice(b.name.length + 3);
      var date = cleanDate(a.date), time = cleanTime(a.time);
      var wid = intId(a.wallet_id);
      var walletId = null, txId = null;
      if (wid != null && walletExists(wid)) {
        walletId = wid;
        txId = insertTx({
          type: direction === "gave" ? "expense" : "income",
          amount: amount, walletId: walletId, category: "ব্যবসা",
          note: note ? b.name + " — " + note : b.name, date: date, time: time
        });
      }
      var id = DB.next.businessEntry++;
      b.entries.push({
        id: id, direction: direction, amount: amount, note: note,
        date: date, time: time, wallet_id: walletId, tx_id: txId
      });
      save(DB);
      return { id: id };
    },
    updateBusinessEntry: function (a) {
      var found = findBizEntry(intId(a.id));
      if (!found) throw new Error("এন্ট্রি পাওয়া যায়নি");
      var entry = found.entry;
      var direction = cleanBizDir(a.direction);
      var amount = cleanAmount(a.amount);
      var note = cleanNote(a.note);
      if (note.indexOf(found.biz.name + " — ") === 0) note = note.slice(found.biz.name.length + 3);
      var date = cleanDate(a.date), time = cleanTime(a.time);
      var wid = intId(a.wallet_id);
      var txId = entry.tx_id != null ? entry.tx_id : null;
      if (txId != null && !find(DB.transactions, txId)) txId = null;
      var walletId = null, staleTxId = null;
      if (wid != null && walletExists(wid)) {
        walletId = wid;
        var txNote = note ? found.biz.name + " — " + note : found.biz.name;
        if (txId != null) {
          var tx = find(DB.transactions, txId);
          tx.type = direction === "gave" ? "expense" : "income";
          tx.amount = amount; tx.wallet_id = walletId; tx.category = "ব্যবসা";
          tx.note = txNote; tx.date = date; tx.time = time;
        } else {
          txId = insertTx({
            type: direction === "gave" ? "expense" : "income",
            amount: amount, walletId: walletId, category: "ব্যবসা",
            note: txNote, date: date, time: time
          });
        }
      } else if (txId != null) {
        staleTxId = txId;
        txId = null;
      }
      entry.direction = direction; entry.amount = amount; entry.note = note;
      entry.date = date; entry.time = time; entry.wallet_id = walletId; entry.tx_id = txId;
      if (staleTxId != null) deleteTx(staleTxId);
      save(DB);
      return { ok: true };
    },
    deleteBusinessEntry: function (a) {
      var found = findBizEntry(intId(a.id));
      if (!found) throw new Error("এন্ট্রি পাওয়া যায়নি");
      var txId = found.entry.tx_id != null ? found.entry.tx_id : null;
      found.biz.entries = (found.biz.entries || []).filter(function (e) { return e.id !== found.entry.id; });
      if (txId != null) deleteTx(txId);
      save(DB);
      return { ok: true };
    },

    importBackup: function (a) {
      // The client sends the flat backup payload (wallets, transactions,
      // ...); older callers wrapped it as {data}. Accept both.
      var data = (a && isPlainObject(a.data)) ? a.data : a;
      if (!isPlainObject(data) || !Array.isArray(data.wallets) || !Array.isArray(data.transactions)) {
        throw new Error("ভুল ব্যাকআপ ফাইল");
      }
      var sections = ["tasks", "loans", "bazar_lists", "goals", "businesses", "budgets", "notes"];
      for (var si = 0; si < sections.length; si++) {
        if (data[sections[si]] === undefined) data[sections[si]] = [];
        if (!Array.isArray(data[sections[si]])) throw new Error("ভুল ব্যাকআপ ফাইল");
      }
      var rows = [data.wallets, data.transactions, data.tasks, data.loans, data.bazar_lists, data.goals, data.businesses, data.budgets, data.notes];
      for (var i = 0; i < rows.length; i++) {
        for (var j = 0; j < rows[i].length; j++) {
          if (!isPlainObject(rows[i][j])) throw new Error("ভুল ব্যাকআপ ফাইল");
        }
      }
      var walletIds = {};
      data.wallets.forEach(function (w) { walletIds[w.id] = true; });
      var badTx = null;
      data.transactions.forEach(function (t) { if (!walletIds[t.wallet_id]) badTx = t; });
      if (badTx) {
        return { ok: false, wallets_imported: 0, transactions_imported: 0, error: "ব্যাকআপ ফাইলে অজানা ওয়ালেটের লেনদেন আছে।" };
      }
      var next = { wallet: 1, transaction: 1, task: 1, loan: 1, bazarList: 1, bazarItem: 1, goal: 1, business: 1, businessEntry: 1, budget: 1, note: 1 };
      var walletMap = {};
      var newWallets = data.wallets.map(function (w) {
        var id = next.wallet++;
        walletMap[w.id] = id;
        return { id: id, name: cleanStr(w.name, 60), kind: cleanKind(w.kind), opening_balance: cleanMoney(w.opening_balance) };
      });
      var txIdMap = {};
      var newTxs = newWallets.length === 0 ? [] : data.transactions.map(function (t) {
        var id = next.transaction++;
        if (t.id != null) txIdMap[t.id] = id;
        var txCat = cleanStr(t.category, 60) || "অন্যান্য";
        var txCats = normalizeCategories(t.categories, txCat);
        return {
          id: id, type: t.type === "income" ? "income" : "expense", amount: cleanAmount(t.amount),
          wallet_id: walletMap[t.wallet_id] || newWallets[0].id,
          category: txCats[0], categories: txCats,
          subcategories: normalizeSubcategories(t.subcategories, txCats),
          note: cleanNote(t.note),
          date: cleanDate(t.date), time: cleanTime(t.time)
        };
      });
      var newTasks = data.tasks.map(function (t) {
        return { id: next.task++, title: cleanStr(t.title, 120), date: cleanDate(t.date), done: bool(t.done) };
      });
      var newLoans = data.loans.map(function (l) {
        return {
          id: next.loan++, person: cleanStr(l.person, 60), phone: cleanStr(l.phone, 24), direction: cleanLoanDir(l.direction),
          amount: cleanAmount(l.amount), note: cleanNote(l.note), date: cleanDate(l.date), settled: bool(l.settled),
          wallet_id: l.wallet_id != null ? (walletMap[l.wallet_id] || null) : null,
          paid: bool(l.settled) ? cleanAmount(l.amount) : Math.min(cleanAmount(l.amount), cleanAmount(l.paid || 0)), preexisting: bool(l.preexisting)
        };
      });
      var newLists = data.bazar_lists.map(function (l) {
        var items = Array.isArray(l.items) ? l.items : [];
        return {
          id: next.bazarList++, title: cleanStr(l.title, 80), date: cleanDate(l.date),
          wallet_id: l.wallet_id != null ? (walletMap[l.wallet_id] || null) : null,
          items: items.map(function (it) {
            return {
              id: next.bazarItem++, name: cleanStr(it.name, 80), qty: cleanStr(it.qty, 40),
              price: cleanMoney(it.price), done: bool(it.done),
              tx_id: it.tx_ref != null ? (txIdMap[it.tx_ref] || null) : null
            };
          })
        };
      });
      var newGoals = data.goals.map(function (g) {
        return {
          id: next.goal++, name: cleanStr(g.name, 60), saved: cleanMoney(g.saved),
          target: cleanMoney(g.target), type: cleanGoalType(g.type), created_date: cleanDate(g.created_date)
        };
      });
      var newBusinesses = data.businesses.map(function (b) {
        var entries = Array.isArray(b.entries) ? b.entries : [];
        return {
          id: next.business++, name: cleanStr(b.name, 80), note: cleanNote(b.note),
          entries: entries.map(function (e) {
            return {
              id: next.businessEntry++, direction: cleanBizDir(e.direction),
              amount: cleanAmount(e.amount), note: cleanNote(e.note),
              date: cleanDate(e.date), time: cleanTime(e.time),
              wallet_id: e.wallet_id != null ? (walletMap[e.wallet_id] || null) : null,
              tx_id: e.tx_ref != null ? (txIdMap[e.tx_ref] || null) : null
            };
          })
        };
      });
      var newBudgets = data.budgets.filter(function (b) {
        return typeof b.month === "string" && /^\d{4}-\d{2}$/.test(b.month) && typeof b.amount === "number";
      }).map(function (b) {
        return {
          id: next.budget++, month: b.month,
          category: typeof b.category === "string" ? cleanStr(b.category, 60) : "",
          amount: cleanMoney(b.amount)
        };
      });
      var newNotes = data.notes.filter(function (n) {
        return typeof n.title === "string" && typeof n.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(n.date);
      }).map(function (n) {
        return {
          id: next.note++, title: cleanStr(n.title, 120),
          body: typeof n.body === "string" ? cleanStr(n.body, 4000) : "",
          date: n.date
        };
      });
      // v12: backup v8 carries social_links; older backups have no such
      // field and keep the current links (never wipe them).
      var importedLinks = isPlainObject(data.social_links) ? cleanSocialLinks(data.social_links) : cleanSocialLinks(DB.social_links);
      DB = {
        version: 1, next: next, wallets: newWallets, transactions: newTxs,
        tasks: newTasks, loans: newLoans, bazar_lists: newLists, goals: newGoals,
        businesses: newBusinesses, budgets: newBudgets, notes: newNotes,
        social_links: importedLinks
      };
      save(DB);
      return { ok: true, wallets_imported: newWallets.length, transactions_imported: newTxs.length, error: null };
    }
  };

  /* ---------- fetch interception: POST ./actions -> local answers ---------- */
  var nativeFetch = window.fetch.bind(window);
  window.fetch = function (input, init) {
    var urlStr = typeof input === "string" ? input : (input && input.url) || "";
    var u;
    try { u = new URL(urlStr, window.location.href); } catch (e) { return nativeFetch(input, init); }
    if (!u.pathname.endsWith("/actions")) return nativeFetch(input, init);
    return Promise.resolve().then(function () {
      var bodyText = (init && init.body) || (typeof input !== "string" && input && input.body) || "";
      var payload = JSON.parse(typeof bodyText === "string" ? bodyText : "");
      var fn = actions[payload.action];
      if (typeof fn !== "function") throw new Error("অজানা অ্যাকশন: " + payload.action);
      var result = fn(payload.args || {});
      return new Response(JSON.stringify({ data: result }), {
        status: 200, headers: { "Content-Type": "application/json" }
      });
    }).catch(function (e) {
      return new Response(JSON.stringify({ error: e && e.message ? e.message : String(e) }), {
        status: 200, headers: { "Content-Type": "application/json" }
      });
    });
  };

  /* ---------- downloads: blob: anchor clicks -> Android bridge ---------- */
  var origAnchorClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    var href = this.getAttribute("href") || "";
    var dl = this.getAttribute("download");
    if (dl && href.indexOf("blob:") === 0 && window.HisabKoiBridge && window.HisabKoiBridge.saveFile) {
      var anchor = this;
      nativeFetch(href).then(function (r) { return r.arrayBuffer(); }).then(function (buf) {
        var bytes = new Uint8Array(buf), bin = "", CH = 0x8000;
        for (var i = 0; i < bytes.length; i += CH) {
          bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
        }
        window.HisabKoiBridge.saveFile(dl, btoa(bin), anchor.type || "application/octet-stream");
      }).catch(function () { origAnchorClick.call(anchor); });
      return;
    }
    return origAnchorClick.call(this);
  };

  /* ---------- native Bangla voice (Android APK only) ----------
   * The Web Speech API does not exist as a working service inside an
   * Android WebView, so the web app's mic buttons used to see no
   * SpeechRecognition and report voice as unsupported. When the native
   * AndroidVoice bridge exists (injected by MainActivity), install a
   * SpeechRecognition polyfill on top of it with the same shape the app
   * uses: lang, interimResults, maxAlternatives, onresult (with
   * results[i].isFinal + alternatives[i].transcript), onerror, onend,
   * start(), stop(). The app's draft -> preview -> OK flow is untouched;
   * this only supplies the transcript.
   *
   * ROOT CAUSE fixed here (v7): the old code returned early whenever
   * ANY window.SpeechRecognition / webkitSpeechRecognition existed.
   * Android WebView DOES expose a webkitSpeechRecognition constructor
   * (MDN compat data lists it for WebView), but it has no recognition
   * service behind it, so tapping the mic did nothing at all: the app
   * used the dead built-in object, start() never produced a result or
   * an error, and no permission prompt or listening state appeared.
   * So when the native bridge exists we now ALWAYS install the
   * polyfill, overriding any built-in object. And when there is no
   * bridge and no working recogniser, we install a stub whose start()
   * fires a clear Bengali error instead of failing silently, so a mic
   * tap can never again be a silent no-op. In a real browser (no
   * bridge, no WebView UA) the built-in Web Speech API is left alone. */
  var __voiceDiag = { bridge: false, builtInSR: false, polyfill: false, stub: false, webView: false };
  window.__hisabkoiVoiceDiag = __voiceDiag;
  (function installNativeVoice() {
    try {
      if (typeof window === "undefined") return;
      var ua = "";
      try { ua = (navigator && navigator.userAgent) || ""; } catch (e) { /* no navigator */ }
      // Android WebView user agents contain "; wv" (Chrome for Android does not).
      __voiceDiag.webView = ua.indexOf("; wv") !== -1 || ua.indexOf("Version/4.0") !== -1;
      __voiceDiag.builtInSR = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
      __voiceDiag.bridge = !!(window.AndroidVoice && typeof window.AndroidVoice.startListening === "function");

      if (__voiceDiag.bridge) {
        installPolyfill();
        return;
      }
      // No bridge (yet?): the interface is injected before loadUrl, but
      // retry briefly in case it appears late, then fall through.
      var tries = 0;
      var timer = setInterval(function () {
        tries++;
        if (window.AndroidVoice && typeof window.AndroidVoice.startListening === "function") {
          clearInterval(timer);
          __voiceDiag.bridge = true;
          installPolyfill();
        } else if (tries >= 15) {
          clearInterval(timer);
          installNoVoiceStubIfNeeded();
        }
      }, 400);
      // If there is no built-in recogniser at all, or we are in a
      // WebView (whose built-in recogniser has no service behind it),
      // install the stub right away so the mic button renders and a tap
      // explains instead of staying silent; the interval above still
      // upgrades to the polyfill if the bridge shows up late.
      if (!__voiceDiag.builtInSR || __voiceDiag.webView) installNoVoiceStubIfNeeded();
    } catch (e) { /* never break the app if the bridge misbehaves */ }
  })();

  function installNoVoiceStubIfNeeded() {
    try {
      // Only in a WebView (dead or absent recogniser) or when nothing
      // else exists: never shadow a real browser's working Web Speech.
      if (__voiceDiag.stub || __voiceDiag.polyfill) return;
      var inWebView = __voiceDiag.webView;
      var hasSR = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
      if (!inWebView && hasSR) return;
      if (!inWebView && !hasSR) return; // plain non-browser env (tests): stay undefined
      if (window.SpeechRecognition && window.SpeechRecognition.__hisabkoiNative) return;
      function NoVoiceRecognition() {
        this.lang = "bn-BD";
        this.interimResults = true;
        this.continuous = false;
        this.maxAlternatives = 3;
        this.onresult = null;
        this.onerror = null;
        this.onend = null;
        this.onstart = null;
      }
      NoVoiceRecognition.prototype.start = function () {
        var self = this;
        setTimeout(function () {
          if (typeof self.onerror === "function") {
            try { self.onerror({ error: "service-not-allowed", message: "ভয়েস চালু করা যায়নি — অ্যাপটি বন্ধ করে আবার খুলুন, তাও না হলে APK আবার ইনস্টল করুন" }); } catch (e) { /* app handler */ }
          }
          if (typeof self.onend === "function") {
            try { self.onend(); } catch (e) { /* app handler */ }
          }
        }, 0);
      };
      NoVoiceRecognition.prototype.stop = function () {
        if (typeof this.onend === "function") { try { this.onend(); } catch (e) { /* app handler */ } }
      };
      NoVoiceRecognition.prototype.abort = function () {
        if (typeof this.onend === "function") { try { this.onend(); } catch (e) { /* app handler */ } }
      };
      window.SpeechRecognition = NoVoiceRecognition;
      window.webkitSpeechRecognition = NoVoiceRecognition;
      __voiceDiag.stub = true;
    } catch (e) { /* never break the app */ }
  }

  function installPolyfill() {
    try {
      if (__voiceDiag.polyfill) return;
      if (!window.AndroidVoice || typeof window.AndroidVoice.startListening !== "function") return;
      var current = null;
      var lastError = null;

      window.__hisabkoiVoice = {
        isNative: true,
        lastError: null,
        onResult: function (payload) {
          var inst = current;
          if (!inst) return;
          var data;
          try { data = typeof payload === "string" ? JSON.parse(payload) : payload; } catch (e) { return; }
          if (!data || !data.transcripts || !data.transcripts.length) return;
          var result = { isFinal: !!data.isFinal, length: data.transcripts.length };
          for (var i = 0; i < data.transcripts.length; i++) {
            result[i] = { transcript: data.transcripts[i], confidence: 0.9 };
          }
          var ev = { results: [result], resultIndex: 0 };
          ev.results.length = 1;
          ev.results[0] = result;
          if (typeof inst.onresult === "function") {
            try { inst.onresult(ev); } catch (e) { /* app handler */ }
          }
          if (data.isFinal) {
            current = null;
            inst._listening = false;
            if (typeof inst.onend === "function") {
              try { inst.onend(); } catch (e) { /* app handler */ }
            }
          }
        },
        onError: function (payload) {
          var inst = current;
          current = null;
          var err = { error: "aborted", message: "" };
          try {
            var data = typeof payload === "string" ? JSON.parse(payload) : payload;
            if (data) {
              if (data.code) err.error = data.code;
              if (data.message) err.message = data.message;
            }
          } catch (e) { /* keep default */ }
          lastError = err;
          window.__hisabkoiVoice.lastError = err;
          if (inst) {
            inst._listening = false;
            if (typeof inst.onerror === "function") {
              try { inst.onerror(err); } catch (e) { /* app handler */ }
            }
            if (typeof inst.onend === "function") {
              try { inst.onend(); } catch (e) { /* app handler */ }
            }
          }
        }
      };

      function NativeSpeechRecognition() {
        this.lang = "bn-BD";
        this.interimResults = true;
        this.continuous = false;
        this.maxAlternatives = 3;
        this.onresult = null;
        this.onerror = null;
        this.onend = null;
        this.onstart = null;
        this._listening = false;
      }
      NativeSpeechRecognition.prototype.start = function () {
        if (this._listening) return;
        // If the device has no recogniser at all (no Google app), fail
        // visibly right away instead of waiting on a silent native call.
        try {
          if (typeof window.AndroidVoice.isAvailable === "function" && !window.AndroidVoice.isAvailable()) {
            window.__hisabkoiVoice.onError(JSON.stringify({ code: "service-not-allowed", message: "এই ফোনে ভয়েস শোনার ব্যবস্থা নেই — Google অ্যাপ আপডেট করে আবার চেষ্টা করুন" }));
            return;
          }
        } catch (e) { /* fall through to startListening */ }
        this._listening = true;
        current = this;
        lastError = null;
        window.__hisabkoiVoice.lastError = null;
        try {
          window.AndroidVoice.startListening();
        } catch (e) {
          this._listening = false;
          current = null;
          window.__hisabkoiVoice.onError(JSON.stringify({ code: "aborted", message: "ভয়েস চালু করা যায়নি, আবার চেষ্টা করুন" }));
          return;
        }
        if (typeof this.onstart === "function") {
          try { this.onstart(); } catch (e) { /* app handler */ }
        }
      };
      NativeSpeechRecognition.prototype.stop = function () {
        this._listening = false;
        try { window.AndroidVoice.stopListening(); } catch (e) { /* bridge gone */ }
      };
      NativeSpeechRecognition.prototype.abort = function () {
        this._listening = false;
        current = null;
        try { window.AndroidVoice.cancelListening(); } catch (e) { /* bridge gone */ }
        if (typeof this.onend === "function") {
          try { this.onend(); } catch (e) { /* app handler */ }
        }
      };

      window.SpeechRecognition = NativeSpeechRecognition;
      window.webkitSpeechRecognition = NativeSpeechRecognition;
      __voiceDiag.polyfill = true;
    } catch (e) { /* never break the app if the bridge misbehaves */ }
  }

  /* Expose a tiny debug handle (harmless in production). */
  window.__hisabkoiOffline = {
    getState: getState,
    resetToSeed: function () {
      var s = JSON.parse(JSON.stringify(SEED));
      DB = s; save(DB);
      return getState();
    }
  };
})();
