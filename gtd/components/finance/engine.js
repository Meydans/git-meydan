// The "איפה אנחנו עומדים" page, ported from the standalone HTML file: the model, treemap, decision
// checker and tables are unchanged. Only the storage differs: rows come from the database and
// every edit goes through the Server Actions in opts.
//
// initFinance(root, opts) fills `root`, wires it up and returns a cleanup function.
import { MARKUP } from './markup.js';

// ---------- הגדרות ----------
const COLS = ['שם','סוג','של מי','גוף מנהל','נזילות','נזיל מתאריך','ייעוד','שווי','מטבע','הפקדה חודשית','עודכן','איך בודקים','לבדוק','הערות','לינק'];
const KEYS = ['name','type','owner','inst','liq','liqDate','purpose','value','cur','monthly','updated','how','check','notes','link'];
const LIQ = [
  { key: 'מיידי',        desc: 'זמין תוך ימים, בלי עלות משמעותית' },
  { key: 'נזיל בעלות',   desc: 'אפשר למשוך, אבל עם מס או ויתור על הטבה' },
  { key: 'נעול עד תאריך', desc: 'נפתח בתאריך מסוים' },
  { key: 'פרישה',        desc: 'זמין רק בגיל פרישה' },
  { key: 'לא נזיל',      desc: 'נדל״ן וכדומה, מימוש לוקח חודשים' },
];
const TYPES = ['עו״ש','קרן כספית','תיק השקעות','גמל להשקעה','קרן השתלמות','פנסיה','פוליסת חיסכון','מניות חברה','קריפטו','נדל״ן','הלוואה','פרמטר','תרחיש','אחר'];
const STALE_DAYS = 100;

const DEMO_CSV = `${COLS.join(',')}
שער דולר,פרמטר,,,,,,3.7,,,,,,
הוצאה חודשית,פרמטר,,,,,,30000,,,,,,
הכנסה חודשית נטו,פרמטר,,,,,,42000,,,,,,
עו״ש משותף (דוגמה),עו״ש,משותף,בנק א,מיידי,,כללי,40000,ILS,,2026-10-01,אפליקציית הבנק,,
קרן כספית (דוגמה),קרן כספית,משותף,בית השקעות,מיידי,,חירום,90000,ILS,,2026-10-01,אתר בית ההשקעות,,
תיק מדד (דוגמה),תיק השקעות,בן/בת זוג א,בית השקעות,נזיל בעלות,,כללי,120000,ILS,2000,2026-10-01,אתר בית ההשקעות,,
קרן השתלמות א (דוגמה),קרן השתלמות,בן/בת זוג א,קופה א,נעול עד תאריך,2027-03-01,כללי,180000,ILS,1500,2026-10-01,אזור אישי,,
קרן השתלמות ב (דוגמה),קרן השתלמות,בן/בת זוג ב,קופה ב,נעול עד תאריך,,כללי,150000,ILS,1200,2026-02-01,אזור אישי,מתי נפתחה הקרן?,
פנסיה א (דוגמה),פנסיה,בן/בת זוג א,קרן פנסיה,פרישה,,פרישה,500000,ILS,,2026-10-01,הר הכסף / מסלקה,,
פנסיה ב (דוגמה),פנסיה,בן/בת זוג ב,קרן פנסיה,פרישה,,פרישה,450000,ILS,,2026-10-01,הר הכסף / מסלקה,,
תוכנית מניות (דוגמה),מניות חברה,בן/בת זוג א,מעסיק,נעול עד תאריך,2027-05-01,כללי,10000,USD,4000,2026-10-01,פורטל המניות,,
קריפטו (דוגמה),קריפטו,בן/בת זוג א,ארנק,מיידי,,כללי,1500,USD,,2026-10-01,אפליקציית הארנק,,
דירה (דוגמה),נדל״ן,משותף,,לא נזיל,,מגורים,3000000,ILS,,2026-06-01,הערכה לפי עסקאות באזור,,
משכנתא (דוגמה),הלוואה,משותף,בנק א,,,,600000,ILS,6000,2026-06-01,דוח יתרות מהבנק,,
ירושה עתידית (דוגמה),תרחיש,,,,,,,ILS,,,,,טווח משוער בלבד`;


export function initFinance(root, opts) {
  root.innerHTML = MARKUP;
  const $ = s => root.querySelector(s);
  const cleanups = [];
  const listen = (target, ev, fn) => { target.addEventListener(ev, fn); cleanups.push(() => target.removeEventListener(ev, fn)); };
  let snaps = opts.snapshots || [];
  let pending = Promise.resolve();
  const setInfo = t => { $('#loadinfo').textContent = t; };
  const errText = e => (e && e.message) || String(e);

// ---------- מצב ----------
let rows = [];
let isDemo = true;
let groupBy = 'liq';

// ---------- עזרים ----------

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const nf = new Intl.NumberFormat('he-IL', { maximumFractionDigits: 0 });
const ils = n => '₪' + nf.format(Math.round(n));
function short(n) {
  const a = Math.abs(n), s = n < 0 ? '-' : '';
  if (a >= 1e6) return s + (a / 1e6).toFixed(2).replace(/\.?0+$/, '') + ' מיליון ₪';
  if (a >= 1e4) return s + Math.round(a / 1e3) + ' אלף ₪';
  return s + ils(a);
}
function parseNum(v) {
  if (v == null) return null;
  const s = String(v).replace(/[₪$,\s]/g, '').replace(/[^\d.\-]/g, '');
  if (s === '' || s === '-' || s === '.') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
function parseDate(v) {
  if (!v) return null;
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  m = s.match(/^(\d{1,2})[\/.](\d{1,2})[\/.](\d{2,4})$/);
  if (m) { const y = +m[3] < 100 ? 2000 + +m[3] : +m[3]; return new Date(y, +m[2] - 1, +m[1]); }
  return null;
}
const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const today = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const daysSince = d => Math.round((today() - d) / 864e5);

// ---------- CSV ----------
function parseCSV(text) {
  text = text.replace(/^﻿/, '');
  const out = []; let row = [], f = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; }
      else f += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(f); f = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(f); f = ''; out.push(row); row = [];
    } else f += c;
  }
  if (f !== '' || row.length) { row.push(f); out.push(row); }
  return out.filter(r => r.some(c => c.trim() !== ''));
}
function csvToRows(text) {
  const t = parseCSV(text);
  if (!t.length) throw new Error('הקובץ ריק');
  const head = t[0].map(h => h.trim());
  const idx = COLS.map(c => head.indexOf(c));
  if (idx[0] < 0 || idx[7] < 0) throw new Error('לא נמצאו העמודות "שם" ו"שווי". השתמשו בתבנית.');
  return t.slice(1).map(r => {
    const o = {};
    KEYS.forEach((k, i) => { o[k] = idx[i] >= 0 ? (r[idx[i]] ?? '').trim() : ''; });
    return o;
  });
}
function rowsToCSV() {
  const q = v => { const s = String(v ?? ''); return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  return '﻿' + [COLS.join(','), ...rows.map(r => KEYS.map(k => q(r[k])).join(','))].join('\r\n');
}

// ---------- מודל ----------
function param(name, fallback) {
  const r = rows.find(r => r.type === 'פרמטר' && r.name === name);
  const n = r ? parseNum(r.value) : null;
  return n ?? fallback;
}
function model() {
  const rate = param('שער דולר', 3.7);
  const expense = param('הוצאה חודשית', null);
  const income = param('הכנסה חודשית נטו', null);
  const t = today();
  const items = rows.map((r, i) => {
    const raw = parseNum(r.value);
    const ils = raw == null ? null : (String(r.cur).toUpperCase() === 'USD' ? raw * rate : raw);
    let liq = r.liq || 'לא נזיל';
    const ld = parseDate(r.liqDate);
    let opened = false;
    if (liq === 'נעול עד תאריך' && ld && ld <= t) { liq = 'נזיל בעלות'; opened = true; }
    const up = parseDate(r.updated);
    return { ...r, i, raw, ils, liqEff: liq, liqD: ld, opened, upD: up, stale: !up || daysSince(up) > STALE_DAYS };
  });
  const assets = items.filter(x => !['פרמטר', 'תרחיש', 'הלוואה'].includes(x.type));
  const liabs = items.filter(x => x.type === 'הלוואה');
  const scen = items.filter(x => x.type === 'תרחיש');
  const sum = a => a.reduce((s, x) => s + (x.ils || 0), 0);
  const by = k => assets.filter(x => x.liqEff === k);
  const emergency = sum(assets.filter(x => x.purpose === 'חירום'));
  const liquid = sum(by('מיידי')) + sum(by('נזיל בעלות'));
  return {
    rate, expense, income, items, assets, liabs, scen,
    total: sum(assets), debt: sum(liabs),
    net: sum(assets) - sum(liabs),
    liquid, emergency, free: liquid - emergency,
    locked: sum(by('נעול עד תאריך')), pension: sum(by('פרישה')), illiquid: sum(by('לא נזיל')),
  };
}

// ---------- מספרים ראשיים ----------
function renderHero(m) {
  const months = m.expense ? m.liquid / m.expense : null;
  const surplus = m.income != null && m.expense != null ? m.income - m.expense : null;
  $('#hero').innerHTML = `
    <div class="tile main">
      <div class="label">שווי נקי (נכסים פחות הלוואות)</div>
      <div class="value num">${short(m.net)}</div>
      <div class="note">נכסים ${short(m.total)} · הלוואות ${short(m.debt)}</div>
    </div>
    <div class="tile">
      <div class="label">נזיל עכשיו</div>
      <div class="value num">${short(m.liquid)}</div>
      <div class="note">${months != null ? `מכסה כ-${months.toFixed(0)} חודשי מחיה` : 'הוסיפו פרמטר "הוצאה חודשית"'}</div>
    </div>
    <div class="tile">
      <div class="label">פנוי להחלטות</div>
      <div class="value num">${short(m.free)}</div>
      <div class="note">נזיל, בלי קרן החירום (${short(m.emergency)})</div>
    </div>
    <div class="tile">
      <div class="label">עודף חודשי</div>
      <div class="value num">${surplus != null ? short(surplus) : '—'}</div>
      <div class="note">${surplus != null ? `הכנסה ${short(m.income)} פחות הוצאה ${short(m.expense)}` : 'הוסיפו הכנסה והוצאה כפרמטרים'}</div>
    </div>`;
}

// ---------- מפה (treemap) ----------
function worst(areas, s) {
  const sum = areas.reduce((a, b) => a + b, 0), mx = Math.max(...areas), mn = Math.min(...areas);
  return Math.max(s * s * mx / (sum * sum), (sum * sum) / (s * s * mn));
}
function squarify(nodes, x, y, w, h) {
  const total = nodes.reduce((a, n) => a + n.v, 0);
  if (!total || w <= 0 || h <= 0) return [];
  const k = (w * h) / total;
  const list = nodes.map(n => ({ n, a: n.v * k }));
  const out = []; let i = 0;
  while (i < list.length) {
    const s = Math.min(w, h);
    let row = [list[i]], j = i + 1;
    while (j < list.length) {
      const cand = row.concat(list[j]);
      if (worst(cand.map(o => o.a), s) <= worst(row.map(o => o.a), s)) { row = cand; j++; } else break;
    }
    const rs = row.reduce((a, o) => a + o.a, 0);
    if (w >= h) {
      const cw = rs / h; let cy = y;
      row.forEach(o => { const ch = o.a / cw; out.push({ n: o.n, x, y: cy, w: cw, h: ch }); cy += ch; });
      x += cw; w -= cw;
    } else {
      const rh = rs / w; let cx = x;
      row.forEach(o => { const cwd = o.a / rh; out.push({ n: o.n, x: cx, y, w: cwd, h: rh }); cx += cwd; });
      y += rh; h -= rh;
    }
    i = j;
  }
  return out;
}
const liqVar = k => `var(--liq-${LIQ.findIndex(l => l.key === k) + 1 || 5})`;
function textOn(el) {
  // צבע טקסט לפי בהירות הרקע בפועל
  const c = getComputedStyle(el).backgroundColor.match(/\d+/g);
  if (!c) return;
  const [r, g, b] = c.map(Number).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  const L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  el.style.color = L > 0.3 ? '#0b0b0b' : '#ffffff';
}
function groupKey(x) {
  if (groupBy === 'owner') return x.owner || 'לא צוין';
  if (groupBy === 'type') return x.type || 'אחר';
  return x.liqEff;
}
function renderTreemap(m) {
  const box = $('#treemap');
  box.innerHTML = '';
  const W = box.clientWidth, H = box.clientHeight;
  const items = m.assets.filter(x => x.ils > 0 && !($('#hideRE').checked && x.type === 'נדל״ן'));
  if (!items.length) { box.innerHTML = '<p class="muted">אין עדיין נכסים עם סכום.</p>'; return; }
  const groups = {};
  items.forEach(x => { (groups[groupKey(x)] ||= []).push(x); });
  let gNodes = Object.entries(groups).map(([k, a]) => ({ k, a, v: a.reduce((s, x) => s + x.ils, 0) }));
  if (groupBy === 'liq') gNodes.sort((a, b) => LIQ.findIndex(l => l.key === a.k) - LIQ.findIndex(l => l.key === b.k));
  else gNodes.sort((a, b) => b.v - a.v);
  const HEAD = 20, GAP = 2;
  squarify(gNodes, 0, 0, W, H).forEach(g => {
    const showHead = g.h > 60 && g.w > 70;
    const gx = W - g.x - g.w; // מראה ל-RTL
    if (showHead) {
      const hd = document.createElement('div');
      hd.className = 'tm-ghead';
      hd.style.cssText = `left:${gx}px;top:${g.y}px;width:${g.w}px;height:${HEAD}px;line-height:${HEAD}px`;
      hd.textContent = `${g.n.k} · ${short(g.n.v)}`;
      box.appendChild(hd);
    }
    const top = showHead ? HEAD : 0;
    const kids = g.n.a.map(x => ({ x, v: x.ils })).sort((a, b) => b.v - a.v);
    squarify(kids, 0, 0, g.w, g.h - top).forEach(c => {
      const el = document.createElement('div');
      const x = c.n.x;
      el.className = 'tm-cell' + (x.stale ? ' stale' : '');
      el.tabIndex = 0;
      const left = gx + (g.w - c.x - c.w) + GAP / 2, tp = g.y + top + c.y + GAP / 2;
      el.style.cssText = `left:${left}px;top:${tp}px;width:${Math.max(0, c.w - GAP)}px;height:${Math.max(0, c.h - GAP)}px;background-color:${liqVar(x.liqEff)}`;
      if (c.w > 74 && c.h > 38) el.innerHTML = `<b>${esc(x.name)}</b><span class="num">${short(x.ils)}</span>`;
      else if (c.w > 40 && c.h > 20) el.innerHTML = `<b>${esc(x.name)}</b>`;
      el.setAttribute('aria-label', `${x.name}: ${ils(x.ils)}, ${x.liqEff}`);
      el.dataset.i = x.i;
      box.appendChild(el);
      textOn(el);
    });
  });
  // מקרא: הצבע תמיד = נזילות
  const present = new Set(items.map(x => x.liqEff));
  $('#legend').innerHTML = LIQ.filter(l => present.has(l.key))
    .map(l => `<span title="${esc(l.desc)}"><i class="sw" style="background:${liqVar(l.key)}"></i>${esc(l.key)}</span>`).join('')
    + `<span><i class="sw" style="background:var(--liq-3);background-image:repeating-linear-gradient(135deg,transparent 0 3px,rgba(255,255,255,.5) 3px 5px)"></i>פסים = לא עודכן מעל ${STALE_DAYS} יום</span>`;
  // הלוואות
  const re = m.assets.filter(x => x.type === 'נדל״ן').reduce((s, x) => s + (x.ils || 0), 0);
  $('#liab').innerHTML = m.liabs.length
    ? `<b>הלוואות:</b> ${m.liabs.map(l => `${esc(l.name)} <span class="num">${ils(l.ils || 0)}</span>`).join(' · ')}`
      + (re ? ` · נדל״ן נטו (אחרי הלוואות): <span class="num">${short(re - m.debt)}</span>` : '')
    : '';
}
function renderOwners(m) {
  const own = {};
  m.assets.forEach(x => {
    const k = x.owner || 'לא צוין';
    own[k] ||= { total: 0, liquid: 0, pension: 0 };
    own[k].total += x.ils || 0;
    if (['מיידי', 'נזיל בעלות'].includes(x.liqEff)) own[k].liquid += x.ils || 0;
    if (x.liqEff === 'פרישה') own[k].pension += x.ils || 0;
  });
  $('#owners').innerHTML = Object.entries(own).sort((a, b) => b[1].total - a[1].total).map(([k, o]) => `
    <div class="tile"><div class="label">${esc(k)}</div>
      <div class="value num" style="font-size:20px">${short(o.total)}</div>
      <div class="note">נזיל ${short(o.liquid)} · פנסיה ${short(o.pension)}</div></div>`).join('');
}

// tooltip
function tipFor(x) {
  const parts = [`<b>${esc(x.name)}</b>`, `<span class="num">${ils(x.ils)}</span>${String(x.cur).toUpperCase() === 'USD' ? ` <span class="muted">($${nf.format(x.raw)})</span>` : ''}`];
  parts.push(`נזילות: ${esc(x.liqEff)}${x.opened ? ' (נפתח)' : ''}${x.liqD && !x.opened ? ` · נפתח ב-${x.liqD.toLocaleDateString('he-IL')}` : ''}`);
  if (x.owner) parts.push(`של: ${esc(x.owner)}`);
  if (x.inst) parts.push(`איפה: ${esc(x.inst)}`);
  if (x.how) parts.push(`איך בודקים: ${esc(x.how)}`);
  parts.push(x.upD ? `עודכן: ${x.upD.toLocaleDateString('he-IL')}${x.stale ? ' (ישן)' : ''}` : 'לא ידוע מתי עודכן');
  return parts.join('<br>');
}
function wireTooltip() {
  const tip = $('#tooltip'), box = $('#treemap');
  const show = (el, cx, cy) => {
    const x = state.items[el.dataset.i]; if (!x) return;
    tip.innerHTML = tipFor(x); tip.style.display = 'block';
    const r = tip.getBoundingClientRect();
    let left = cx + 14, top = cy + 14;
    if (left + r.width > innerWidth - 8) left = cx - r.width - 14;
    if (top + r.height > innerHeight - 8) top = cy - r.height - 14;
    tip.style.left = Math.max(8, left) + 'px'; tip.style.top = Math.max(8, top) + 'px';
  };
  box.addEventListener('mousemove', e => { const el = e.target.closest('.tm-cell'); if (el) show(el, e.clientX, e.clientY); else tip.style.display = 'none'; });
  box.addEventListener('mouseleave', () => tip.style.display = 'none');
  box.addEventListener('focusin', e => { const el = e.target.closest('.tm-cell'); if (el) { const r = el.getBoundingClientRect(); show(el, r.left + 10, r.bottom - 10); } });
  box.addEventListener('focusout', () => tip.style.display = 'none');
}

// ---------- בודק החלטה ----------
const TAX_NOTE = {
  'עו״ש': 'אין מס.',
  'קרן כספית': 'מס 25% על הרווח בלבד, הכסף זמין תוך יום-יומיים.',
  'תיק השקעות': 'מס רווחי הון 25% על הרווח בלבד (לא על כל הסכום).',
  'גמל להשקעה': 'משיכה הונית: מס 25% על הרווח הנומינלי, ומוותרים על הטבת המס אם הייתם מושכים כקצבה בפרישה.',
  'קרן השתלמות': 'אחרי 6 שנים מהפתיחה: פטור ממס. אבל זה גם הכסף היחיד שגדל בלי מס בכלל, ולכן חבל לפרק אותו ראשון.',
  'מניות חברה': 'תלוי בתנאי התוכנית (סעיף 102 ומועדי מימוש). כדאי לבדוק לפני.',
  'קריפטו': 'מס 25% על הרווח.',
};
function renderDecisionSources(m) {
  const sel = $('#dSource'), prev = sel.value;
  const opts = m.assets.filter(x => ['מיידי', 'נזיל בעלות'].includes(x.liqEff) && x.purpose !== 'חירום' && x.ils > 0);
  sel.innerHTML = `<option value="surplus">צבירה מהעודף החודשי</option>` +
    opts.map(x => `<option value="${x.i}">${esc(x.name)} (${short(x.ils)})</option>`).join('');
  if ([...sel.options].some(o => o.value === prev)) sel.value = prev;
  else if (opts.length) sel.value = String(opts.sort((a, b) => b.ils - a.ils)[0].i);
}
function renderDecision(m) {
  const amt = parseNum($('#dAmount').value) || 0;
  const what = $('#dName').value.trim() || 'ההחלטה';
  const src = $('#dSource').value;
  const surplus = m.income != null && m.expense != null ? m.income - m.expense : null;
  const out = [];
  const st = (cls, ic, txt) => `<div class="fstatus ${cls}"><span class="ic">${ic}</span><span>${txt}</span></div>`;
  if (!amt) { $('#dOut').innerHTML = '<p class="muted">הזינו סכום.</p>'; return; }

  if (src === 'surplus') {
    if (!surplus || surplus <= 0) { $('#dOut').innerHTML = st('bad', '✕', 'אין עודף חודשי מוגדר. הוסיפו פרמטרים "הכנסה חודשית נטו" ו"הוצאה חודשית".'); return; }
    const mo = amt / surplus;
    out.push(`<p>כדי לצבור <b class="num">${ils(amt)}</b> ל${esc(what)} מהעודף החודשי (<span class="num">${short(surplus)}</span>) צריך כ-<b>${mo.toFixed(1)} חודשים</b>.</p>`);
    out.push(st('good', '✓', 'לא נוגעים בחסכונות הקיימים.'));
    out.push(`<p class="small muted">בזמן הזה העודף לא מושקע במקום אחר.</p>`);
    $('#dOut').innerHTML = out.join(''); return;
  }

  const s = m.items[+src];
  const afterLiquid = m.liquid - amt, afterFree = m.free - amt;
  const mBefore = m.expense ? m.liquid / m.expense : null, mAfter = m.expense ? afterLiquid / m.expense : null;
  out.push(`<div class="compare">
    <span></span><span class="h">היום</span><span class="h">אחרי ${esc(what)}</span>
    <span>נזיל</span><b class="num">${short(m.liquid)}</b><b class="num">${short(afterLiquid)}</b>
    <span>פנוי להחלטות</span><b class="num">${short(m.free)}</b><b class="num">${short(afterFree)}</b>
    ${mBefore != null ? `<span>חודשי מחיה</span><b class="num">${mBefore.toFixed(0)}</b><b class="num">${mAfter.toFixed(0)}</b>` : ''}
    <span>שווי נקי</span><b class="num">${short(m.net)}</b><b class="num">${short(m.net - amt)}</b>
  </div>`);
  if (amt > s.ils) out.push(st('bad', '✕', `ב"${esc(s.name)}" יש רק ${ils(s.ils)}. צריך מקור נוסף ל-${ils(amt - s.ils)}.`));
  else out.push(st('good', '✓', `המקור מכסה את הסכום. נשארים בו ${ils(s.ils - amt)}.`));
  out.push(afterFree >= 0
    ? st('good', '✓', `קרן החירום (${short(m.emergency)}) נשארת שלמה.`)
    : st('bad', '✕', 'הסכום חורג מהכסף הפנוי ונוגע בקרן החירום.'));
  const share = m.liquid ? amt / m.liquid : 1;
  out.push(share <= 0.2
    ? st('good', '✓', `זה ${(share * 100).toFixed(0)}% מהכסף הנזיל.`)
    : st('warn', '!', `זה ${(share * 100).toFixed(0)}% מהכסף הנזיל. חלק משמעותי.`));
  if (surplus > 0) out.push(`<p>חזרה לאותו מצב נזילות: כ-<b>${(amt / surplus).toFixed(1)} חודשי עודף</b>.</p>`);
  if (TAX_NOTE[s.type]) out.push(`<p class="small muted"><b>מס:</b> ${TAX_NOTE[s.type]}</p>`);
  $('#dOut').innerHTML = out.join('');
}

// ---------- מה לבדוק ----------
function linkHref(v) {
  v = String(v || '').trim(); if (!v) return '';
  if (!/^[a-z][a-z0-9+.-]*:/i.test(v)) v = 'https://' + v;
  return /^https?:\/\//i.test(v) ? v : '';
}
function renderQuestions(m) {
  const q = [];
  m.items.forEach(x => {
    if (!x.check) return;
    q.push(`<b>${esc(x.name)}</b>: ${esc(x.check)}${x.how || x.link ? ` <span class="muted small">(בודקים ב: ${linkHref(x.link) ? `<a href="${esc(linkHref(x.link))}" target="_blank" rel="noopener noreferrer">${esc(x.how || 'פתיחת הלינק')} ↗</a>` : esc(x.how)})</span>` : ''}`);
  });
  $('#qs').innerHTML = q.length ? q.map(t => `<li>${t}</li>`).join('') : '<li>אין פריטים בעמודה "לבדוק".</li>';
}

// ---------- תרחישים ----------
function renderScenarios(m) {
  if (!m.scen.length) { $('#scen').innerHTML = '<p class="muted">אין תרחישים. הוסיפו שורה מסוג "תרחיש".</p>'; return; }
  $('#scen').innerHTML = m.scen.map(x => `
    <div style="margin:8px 0">
      <label><input type="checkbox" data-s="${x.i}"> <b>${esc(x.name)}</b>
        ${x.ils ? `<span class="num">${short(x.ils)}</span>` : '<span class="muted">(לא הוזן סכום)</span>'}</label>
      ${x.notes ? `<div class="small muted">${esc(x.notes)}</div>` : ''}
      <div class="small" data-sout="${x.i}"></div>
    </div>`).join('');
  $('#scen').querySelectorAll('input[data-s]').forEach(cb => cb.addEventListener('change', () => {
    const x = m.items[+cb.dataset.s], o = $(`[data-sout="${cb.dataset.s}"]`);
    o.innerHTML = cb.checked && x.ils
      ? `שווי נקי היה <span class="num">${short(m.net + x.ils)}</span> במקום <span class="num">${short(m.net)}</span>${m.expense ? `, ועוד כ-${(x.ils / m.expense / 12).toFixed(1)} שנות מחיה` : ''}.`
      : '';
  }));
}

// ---------- טבלת עריכה ----------
const fmtVal = v => { const n = parseNum(v); return n == null ? (v ?? '') : n.toLocaleString('en-US', { maximumFractionDigits: 2 }); };
let invMode = 'liq';
const GRAY = 'hsl(40 6% 55%)';
const liqColor = r => (r.type === 'פרמטר' || r.type === 'תרחיש' || !LIQ.some(l => l.key === r.liq)) ? GRAY : liqVar(r.liq);
function ageInfo(r) {
  if (r.type === 'פרמטר' || r.type === 'תרחיש') return { c: GRAY, label: '' };
  const d = parseDate(r.updated);
  if (!d) return { c: 'var(--bad)', label: 'לא ידוע מתי עודכן' };
  const n = daysSince(d);
  const label = n < 45 ? `לפני ${n} ימים` : `לפני ${Math.round(n / 30)} חודשים`;
  return { c: n <= STALE_DAYS ? 'var(--good)' : n <= 365 ? 'var(--warn)' : 'var(--bad)', label };
}
function rowColor(r) { return invMode === 'age' ? ageInfo(r).c : liqColor(r); }
function updHTML(r) {
  const a = ageInfo(r);
  return `${esc(r.updated)}${a.label ? `<br><span class="pill" style="--rc:${a.c}">${a.label}</span>` : ''}`;
}
function renderInvLegend() {
  const sw = (c, t) => `<span><i class="sw" style="background:${c}"></i>${t}</span>`;
  $('#invLegend').innerHTML = invMode === 'age'
    ? sw('var(--good)', `עד ${STALE_DAYS} יום`) + sw('var(--warn)', `עד שנה`) + sw('var(--bad)', 'מעל שנה או לא ידוע') + sw(GRAY, 'פרמטר / תרחיש')
    : invMode === 'liq'
      ? LIQ.map(l => sw(liqVar(l.key), esc(l.key))).join('') + sw(GRAY, 'ללא נזילות / פרמטר')
      : '';
}
function renderTable() {
  if (isDemo) { $('#inv').innerHTML = '<tbody><tr><td>מוצגים נתוני דוגמה, ולכן העריכה כבויה. ייבאו קובץ CSV, או <button data-start>התחילו ממלאי ריק</button></td></tr></tbody>'; return; }
  $('#inv').dataset.mode = invMode;
  renderInvLegend();
  const sel = (opts, v, k) => `<select data-k="${k}">${['', ...opts].map(o => `<option${o === v ? ' selected' : ''}>${esc(o)}</option>`).join('')}${v && !opts.includes(v) ? `<option selected>${esc(v)}</option>` : ''}</select>`;
  $('#inv').innerHTML = `<thead><tr><th>שם</th><th>סוג</th><th>של מי</th><th>נזילות</th><th>נזיל מתאריך</th><th>ייעוד</th><th class="r">שווי</th><th>מטבע</th><th>עודכן</th><th>לבדוק</th><th>לינק</th><th></th></tr></thead><tbody>` +
    rows.map((r, i) => `<tr data-r="${i}" style="--rc:${rowColor(r)}">
      <td><input data-k="name" value="${esc(r.name)}"></td>
      <td>${sel(TYPES, r.type, 'type')}</td>
      <td><input data-k="owner" value="${esc(r.owner)}"></td>
      <td>${sel(LIQ.map(l => l.key), r.liq, 'liq')}</td>
      <td><input data-k="liqDate" value="${esc(r.liqDate)}" placeholder="2027-05-01"></td>
      <td><input data-k="purpose" value="${esc(r.purpose)}"></td>
      <td><input class="val" data-k="value" inputmode="decimal" value="${esc(fmtVal(r.value))}"></td>
      <td>${sel(['ILS', 'USD'], r.cur, 'cur')}</td>
      <td class="small muted upd">${updHTML(r)}</td>
      <td><input data-k="check" value="${esc(r.check)}"></td>
      <td class="lk"><input data-k="link" value="${esc(r.link)}" placeholder="https://..."><a class="go" data-go="${i}" ${linkHref(r.link) ? `href="${esc(linkHref(r.link))}" target="_blank" rel="noopener noreferrer" title="פתיחת הלינק"` : 'aria-disabled="true" style="opacity:.3;pointer-events:none"'}>↗</a></td>
      <td><button data-del="${i}" aria-label="מחיקת שורה">✕</button></td>
    </tr>`).join('') + '</tbody>';
}
function onTableChange(e) {
  const tr = e.target.closest('tr[data-r]'); if (!tr) return;
  const r = rows[+tr.dataset.r], k = e.target.dataset.k; if (!k) return;
  r[k] = e.target.value;
  if (k === 'value') { const n = parseNum(r.value); r.value = n == null ? String(r.value).trim() : String(n); e.target.value = fmtVal(r.value); }
  if (k === 'value' && r.type !== 'פרמטר') r.updated = iso(today());
  save(r, k === 'value' && r.type !== 'פרמטר' ? ['value', 'updated'] : [k]); render({ keepTable: k === 'value' });
  tr.style.setProperty('--rc', rowColor(r));
  if (k === 'value') tr.querySelector('td.upd').innerHTML = updHTML(r);
  if (k === 'link') { const a = tr.querySelector('a.go'), h = linkHref(r.link);
    if (h) { a.href = h; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.style.opacity = ''; a.style.pointerEvents = ''; a.removeAttribute('aria-disabled'); }
    else { a.removeAttribute('href'); a.style.opacity = '.3'; a.style.pointerEvents = 'none'; } }
}

// ---------- רינדור ----------
let state = null;
function render(opt = {}) {
  state = model();
  $('#demoBanner').hidden = !isDemo;
  renderHero(state);
  renderTreemap(state);
  renderOwners(state);
  renderDecisionSources(state);
  renderDecision(state);
  renderQuestions(state);
  renderScenarios(state);
  if (!opt.keepTable) renderTable();
}

root.querySelectorAll('.fseg button').forEach(b => b.addEventListener('click', () => {
  groupBy = b.dataset.g;
  root.querySelectorAll('.fseg button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
  renderTreemap(state);
}));
['input', 'change'].forEach(ev => {
  $('#dAmount').addEventListener(ev, () => renderDecision(state));
  $('#dName').addEventListener(ev, () => renderDecision(state));
});
$('#dSource').addEventListener('change', () => renderDecision(state));
$('#inv').addEventListener('change', onTableChange);
$('#invMode').addEventListener('click', e => {
  const b = e.target.closest('button[data-m]'); if (!b) return;
  invMode = b.dataset.m;
  root.querySelectorAll('#invMode button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
  renderTable();
});
wireTooltip();
$('#hideRE').addEventListener('change', () => renderTreemap(state));


// ---------- שמירה ----------
// Edits are saved one at a time, in order, so a slow save can't overwrite a newer one.
function save(r, keys) {
  if (!r.id) return;
  const patch = Object.fromEntries(keys.map(k => [k, r[k]]));
  setInfo('שומר…');
  pending = pending
    .then(() => opts.patchItem(r.id, patch))
    .then(() => setInfo('נשמר ' + new Date().toLocaleTimeString('he-IL')),
      e => setInfo('השמירה נכשלה, נסו שוב: ' + errText(e)));
}
const summaryOf = m => ({ net: m.net, total: m.total, debt: m.debt, liquid: m.liquid });

// ---------- תמונות מצב ----------
function renderSnaps() {
  const list = $('#snaps');
  if (!snaps.length) { list.innerHTML = '<p class="muted small">עוד לא נשמרה תמונת מצב. שמרו אחת בכל עדכון רבעוני כדי לראות את המגמה.</p>'; return; }
  list.innerHTML = '<table class="hist"><thead><tr><th>תאריך</th><th class="r">שווי נקי</th><th class="r">שינוי</th><th class="r">נזיל</th><th>נשמר ע״י</th></tr></thead><tbody>' +
    snaps.map((s, i) => {
      const prev = snaps[i + 1], d = prev ? s.net - prev.net : null;
      return `<tr><td>${new Date(s.takenAt).toLocaleDateString('he-IL')}</td><td class="r num">${short(s.net)}</td>` +
        `<td class="r num">${d == null ? '—' : (d >= 0 ? '+' : '') + short(d)}</td><td class="r num">${short(s.liquid)}</td><td class="small muted">${esc(s.takenBy)}</td></tr>`;
    }).join('') + '</tbody></table>';
}
function renderNudge() {
  const last = snaps[0] ? new Date(snaps[0].takenAt) : null;
  const days = last ? Math.floor((Date.now() - last) / 864e5) : null;
  const due = !isDemo && (days == null || days > 90);
  const box = $('#nudge');
  box.hidden = !due;
  if (due) box.textContent = days == null
    ? 'עוד לא נשמרה תמונת מצב. עברו על "מה צריך לבדוק", עדכנו, ושמרו תמונת מצב.'
    : `עברו ${days} ימים מתמונת המצב האחרונה. זה הזמן לעדכון הרבעוני: עברו על "מה צריך לבדוק", עדכנו, ושמרו תמונת מצב.`;
}

// ---------- ייבוא וייצוא ----------
async function importText(text, name) {
  try {
    const parsed = csvToRows(text);
    if (!isDemo && rows.length && !confirm(`להחליף את כל המלאי (${rows.length} שורות) ב-${parsed.length} שורות מהקובץ? המלאי הנוכחי יישמר כתמונת מצב.`)) return;
    setInfo('מייבא…');
    const backup = !isDemo && rows.length ? summaryOf(model()) : null;
    rows = await opts.importInventory(parsed, backup);
    isDemo = false;
    if (backup) snaps = await opts.listSnapshots();
    render(); renderSnaps(); renderNudge();
    setInfo(`יובאו ${rows.length} שורות מ-${name}`);
  } catch (e) { setInfo('שגיאה: ' + errText(e)); }
}
function loadFile(f) { if (!f) return; const r = new FileReader(); r.onload = () => importText(r.result, f.name); r.readAsText(f, 'utf-8'); }

$('#drop').addEventListener('click', e => { e.preventDefault(); $('#file').click(); });
$('#file').addEventListener('change', e => { loadFile(e.target.files[0]); e.target.value = ''; });
const drop = $('#drop');
['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('over'); }));
drop.addEventListener('drop', e => loadFile(e.dataTransfer.files[0]));
$('#export').addEventListener('click', () => {
  const blob = new Blob([rowsToCSV()], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = `inventory-${iso(today())}.private.csv`;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
});
$('#snap').addEventListener('click', async () => {
  if (isDemo) { setInfo('אין מה לשמור: אלה נתוני דוגמה.'); return; }
  try { snaps = await opts.takeSnapshot(summaryOf(state)); renderSnaps(); renderNudge(); setInfo('תמונת המצב נשמרה'); }
  catch (e) { setInfo('השמירה נכשלה: ' + errText(e)); }
});

// ---------- עריכת שורות ----------
$('#inv').addEventListener('click', async e => {
  const start = e.target.closest('button[data-start]');
  if (start) { rows = []; isDemo = false; render(); renderNudge(); return; }
  const b = e.target.closest('button[data-del]'); if (!b) return;
  const r = rows[+b.dataset.del];
  if (!confirm(`למחוק את "${r.name || 'שורה'}"?`)) return;
  rows.splice(+b.dataset.del, 1); render();
  try { if (r.id) await opts.removeItem(r.id); setInfo('נמחק'); } catch (err) { setInfo('המחיקה נכשלה, רעננו את הדף: ' + errText(err)); }
});
$('#addRow').addEventListener('click', async () => {
  if (isDemo) { setInfo('התחילו ממלאי ריק או ייבאו קובץ לפני שמוסיפים שורות.'); return; }
  try {
    rows.push(await opts.addItem()); renderTable();
    const last = root.querySelector('#inv tbody tr:last-child input[data-k="name"]'); if (last) last.focus();
  } catch (err) { setInfo('ההוספה נכשלה: ' + errText(err)); }
});
let rt;
const onResize = () => { clearTimeout(rt); rt = setTimeout(() => renderTreemap(state), 120); };
listen(window, 'resize', onResize);
wireTooltip();
$('#hideRE').addEventListener('change', () => renderTreemap(state));

// ---------- התחלה ----------
if (opts.rows.length) { rows = opts.rows; isDemo = false; }
else { rows = csvToRows(DEMO_CSV); isDemo = true; }
render(); renderSnaps(); renderNudge();
return () => { clearTimeout(rt); cleanups.forEach(f => f()); root.innerHTML = ''; };
}
