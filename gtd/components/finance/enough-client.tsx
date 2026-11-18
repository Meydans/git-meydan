"use client";

import Link from "next/link";
import { Info as InfoIcon } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, useTransition } from "react";
import { saveSimSettings } from "@/app/(finance)/finance/actions";
import type { InventoryBase } from "@/lib/finance/inventory";
import { END_AGE, goalSeek, simulate, type Assumptions, type CapitalEvent, type Scenario } from "@/lib/finance/simulator";
import "./finance.css";
import "./enough.css";

const ils = (n: number) => "₪" + Math.round(n).toLocaleString("he-IL");
const short = (n: number) => {
  const a = Math.abs(n);
  const s = n < 0 ? "-" : "";
  if (a >= 1e6) return s + (a / 1e6).toFixed(1).replace(/\.0$/, "") + " מיליון ₪";
  if (a >= 1e4) return s + Math.round(a / 1e3) + " אלף ₪";
  return s + ils(a);
};

// Plain-language explanations, shown by the (i) next to each label: hover, focus or tap.
const HELP = {
  liquid: "כסף שאפשר להשתמש בו עכשיו בלי קנס: שורות במלאי שהנזילות שלהן \"מיידי\" או \"נזיל בעלות\" (כולל קרן נעולה שהתאריך שלה כבר עבר). לא כולל פנסיה ונדל\"ן. זה ההון שהתחזית מושיבה ומשקיעה.",
  income: "ההכנסה החודשית נטו של הבית היום, מהפרמטר \"הכנסה חודשית נטו\" במלאי, אחרי התאמת סליידר \"ירידה בהכנסה\". כדי לשנות אותה קבועה, עדכנו את הפרמטר במלאי.",
  expense: "ההוצאה החודשית של הבית היום, מהפרמטר \"הוצאה חודשית\" במלאי, אחרי התאמת הסליידר.",
  surplus: "הכנסה פחות הוצאה בחודש. זה מה שמתווסף להון הנזיל כל שנה (ומוכפל ב-12), כל עוד עובדים.",
  deduct: "קרן חירום נועדה להישאר בצד. כשמסמנים, היא יוצאת מההון שהתחזית משקיעה, והתוצאה שמרנית יותר.",
  atRetirement: "ההון הנזיל הצפוי בגיל הפרישה, אחרי ריבית דריבית, חיסכון שנתי ואירועי הון.",
  fiTarget: "כלל ה-300: הון בגובה 300 פעמים ההוצאה החודשית (בערכי אותה שנה, כולל אינפלציה). מאפשר למשוך כ-4% בשנה בלי לפגוע בקרן.",
  fiAge: "הגיל הראשון, אחרי שנת ההתחלה, שבו ההון הנזיל מגיע ליעד החופש הכלכלי. אם הוא לא מגיע עד גיל 90, כתוב \"לא הושג\".",
  lowest: "הנקודה הנמוכה ביותר שאליה ההון יורד לאורך התחזית. אם היא שלילית, ההון אוזל באותו גיל.",
  incomeLoss: "סכום שמופחת מההכנסה החודשית, כדי לבדוק למשל מעבר לחצי משרה או הפסקת עבודה של אחד מכם. זה תרחיש בלבד ולא נשמר.",
  expenseAdjust: "סכום שמתווסף להוצאה החודשית (או מופחת ממנה, אם שלילי). תרחיש בלבד, לא נשמר.",
  roi: "התשואה השנתית הממוצעת שמניחים על ההון הנזיל, נטו אחרי דמי ניהול ומס. תשואה גבוהה מאוד נראית טוב בגרף אבל לא סבירה לאורך שנים.",
  inflation: "קצב העלייה השנתי במחירים. ההוצאה ושכר העבודה עולים בקצב הזה בכל שנה.",
  currentAge: "הגיל שממנו התחזית מתחילה לרוץ קדימה.",
  retirementAge: "הגיל שבו ההכנסה מעבודה נפסקת (אלא אם סימנתם שהיא נמשכת). מאותו גיל מושכים מהון.",
  pensionAge: "הגיל שבו מתחילה להיכנס קצבת הפנסיה החודשית.",
  pensionRatio: "איזה חלק מההכנסה החודשית של היום תחליף קצבת הפנסיה, מגיל תחילת הפנסיה. 50% אומר קצבה בגובה חצי מההכנסה של היום; 0% אומר בלי פנסיה בכלל. זו הנחה קבועה: הסימולטור לא מחשב את הקצבה מהצבירה בפועל.",
  creep: "העלייה השנתית בהוצאות שמעבר לאינפלציה, בגלל שדרוג רמת החיים. 0% אומר שרמת החיים נשארת אותה רמה.",
  incomeGrowth: "העלייה השנתית בשכר שמעבר לאינפלציה (קידום, העלאות). 0% אומר שהשכר רק עוקב אחרי האינפלציה.",
  workAfter: "אם מסומן, ההכנסה מעבודה ממשיכה גם אחרי גיל הפרישה (למשל עבודה חלקית). אם לא, ההכנסה היחידה אחרי הפרישה היא הפנסיה.",
  glide: "מודל הפחתת סיכון: 8% תשואה ב-10 השנים הראשונות, ואז 4% לשמירה על ההון. כשמסומן הוא מחליף את סליידר התשואה.",
  children: "גילאי הילדים משפיעים על ההוצאה: חלקו של כל ילד בתקציב הילדים יורד בחצי בגיל 18 ונעלם בגיל 21.",
  kids: "כמה מההוצאה החודשית הכוללת הולך לילדים (גן, חוגים וכו'). הסכום הזה קטן עם השנים לפי גיל הילדים.",
  events: "הכנסה או הוצאה חד-פעמית בגיל מסוים, כמו קרן השתלמות שנפתחת (חיובי), שיפוץ או עזרה לילדים בדירה (שלילי). היא נוספת להון בשנה הזו.",
  goalAge: "הגיל שבו הייתם רוצים להגיע לחופש כלכלי. החישוב מראה מה נדרש בשביל זה: חיסכון חודשי גבוה יותר, או תשואה גבוהה יותר.",
  s_now: "ההנחות שלכם כמו שהן שמורות: בלי שינוי בהכנסה ובהוצאה.",
  s_good: "תרחיש אופטימי: תשואה 9%, אינפלציה 1.5%, והוצאה נמוכה ב-2,000 ₪ בחודש.",
  s_safe: "תרחיש שמרני: תשואה 4%, אינפלציה 3%, והוצאה גבוהה ב-2,500 ₪ בחודש.",
  s_crisis: "תרחיש משבר: ירידה של 15,000 ₪ בהכנסה, תשואה 2%, אינפלציה 4% והוצאה גבוהה ב-6,000 ₪.",
  chartBalance: "ההון הנזיל בסוף כל שנה, אחרי צמיחה, חיסכון ואירועי הון. הקו המקווקו הוא יעד החופש הכלכלי של אותה שנה; כשההון חוצה אותו, הגעתם.",
  chartFlow: "הכנסה והוצאה חודשית ממוצעת בכל שנה, בכסף של אותה שנה (כולל אינפלציה). הפער ביניהם הוא החיסכון, ומגיל הפרישה רואים את הירידה בהכנסה.",
} as const;

// Opens on hover or keyboard focus, and stays open when clicked or tapped ("pinned") until a tap
// elsewhere or Escape.
function Info({ text }: { text: string }) {
  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const open = hovered || pinned;
  // Fixed position, measured from the button, so a scrolling panel can't clip the bubble.
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const b = ref.current?.getBoundingClientRect();
      if (!b) return;
      const w = Math.min(280, window.innerWidth - 16);
      setPos({ top: b.bottom + 6, left: Math.max(8, Math.min(b.right - w, window.innerWidth - w - 8)) });
    };
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open]);
  useEffect(() => {
    if (!pinned) return;
    const close = (e: Event) => {
      if (!ref.current?.contains(e.target as Node)) setPinned(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setPinned(false);
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [pinned]);
  return (
    <span className="en-info" ref={ref} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <button
        type="button"
        className="en-i"
        aria-label="הסבר"
        aria-expanded={open}
        onFocus={() => setHovered(true)}
        onBlur={() => setHovered(false)}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setPinned((p) => !p);
        }}
      >
        <InfoIcon size={15} aria-hidden="true" />
      </button>
      {open && pos && <span role="tooltip" className="en-tip" style={{ top: pos.top, left: pos.left }}>{text}</span>}
    </span>
  );
}

function Kpi({ label, help, value, cls }: { label: string; help: string; value: React.ReactNode; cls?: string }) {
  return (
    <div>
      <span>{label} <Info text={help} /></span>
      <b className={"num " + (cls ?? "")}>{value}</b>
    </div>
  );
}

const SCENARIOS: Record<string, { label: string; roi?: number; inflation?: number } & Scenario> = {
  now: { label: "מצב נוכחי", incomeLoss: 0, expenseAdjust: 0 },
  good: { label: "אופטימי", incomeLoss: 0, expenseAdjust: -2000, roi: 9, inflation: 1.5 },
  safe: { label: "שמרני", incomeLoss: 0, expenseAdjust: 2500, roi: 4, inflation: 3 },
  crisis: { label: "משבר", incomeLoss: 15000, expenseAdjust: 6000, roi: 2, inflation: 4 },
};

function Slider(props: { label: string; help?: string; value: number; min: number; max: number; step: number; fmt?: (n: number) => string; onChange: (n: number) => void }) {
  return (
    <label className="en-ctl">
      <span className="en-ctl-top">
        <span>{props.label}{props.help && <> <Info text={props.help} /></>}</span>
        <b className="num">{props.fmt ? props.fmt(props.value) : props.value}</b>
      </span>
      <input type="range" min={props.min} max={props.max} step={props.step} value={props.value} onChange={(e) => props.onChange(Number(e.target.value))} />
    </label>
  );
}

type Pt = { age: number } & Record<string, number>;
type Series = { key: string; label: string; cls: string; area?: boolean };
type Marker = { age: number; label: string; cls: string };

// Round tick steps (1, 2, 2.5, 5 × 10^n) so the grid lines land on readable numbers.
function niceTicks(min: number, max: number, count = 5): number[] {
  const span = Math.max(1, max - min);
  const raw = span / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag;
  const out: number[] = [];
  for (let v = Math.floor(min / step) * step; v <= max + step * 0.001; v += step) out.push(v);
  if (out[out.length - 1] < max) out.push(out[out.length - 1] + step);
  return out;
}

function Chart({ points, series, markers = [], label }: { points: Pt[]; series: Series[]; markers?: Marker[]; label: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 720;
  const H = 300;
  const pad = { l: 64, r: 16, t: 16, b: 30 };
  const ys = points.flatMap((p) => series.map((l) => p[l.key]));
  const ticks = niceTicks(Math.min(...ys, 0), Math.max(...ys, 1));
  const lo = ticks[0];
  const hi = ticks[ticks.length - 1];
  const a0 = points[0].age;
  const a1 = points[points.length - 1].age;
  const x = (age: number) => pad.l + ((age - a0) / Math.max(1, a1 - a0)) * (W - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - (v - lo) / Math.max(1, hi - lo)) * (H - pad.t - pad.b);
  const path = (key: string) => points.map((p, i) => `${i ? "L" : "M"}${x(p.age).toFixed(1)},${y(p[key]).toFixed(1)}`).join("");
  const area = (key: string) => `${path(key)}L${x(a1).toFixed(1)},${y(Math.max(lo, 0)).toFixed(1)}L${x(a0).toFixed(1)},${y(Math.max(lo, 0)).toFixed(1)}Z`;
  const ages = points.filter((p) => p.age % 5 === 0);
  const hp = hover == null ? null : points[hover];

  function move(e: React.PointerEvent<SVGSVGElement>) {
    const box = e.currentTarget.getBoundingClientRect();
    const vx = ((e.clientX - box.left) / box.width) * W;
    const age = a0 + ((vx - pad.l) / (W - pad.l - pad.r)) * (a1 - a0);
    setHover(Math.max(0, Math.min(points.length - 1, Math.round(age - a0))));
  }

  return (
    <div className="en-chart-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} className="en-chart" role="img" aria-label={label} onPointerMove={move} onPointerLeave={() => setHover(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} className={t === 0 ? "en-base" : "en-grid"} />
            <text x={pad.l - 8} y={y(t) + 4} textAnchor="end" className="en-axis">{short(t)}</text>
          </g>
        ))}
        {ages.map((p) => (
          <g key={p.age}>
            <line x1={x(p.age)} x2={x(p.age)} y1={pad.t} y2={H - pad.b} className="en-vgrid" />
            <text x={x(p.age)} y={H - 10} textAnchor="middle" className="en-axis">{p.age}</text>
          </g>
        ))}
        {markers
          .filter((m) => m.age >= a0 && m.age <= a1)
          .map((m, i, all) => {
            // Markers a few years apart would print their labels on top of each other: step them down.
            const row = all.slice(0, i).filter((o) => Math.abs(o.age - m.age) < 6).length;
            const end = x(m.age) > W - 120;
            return (
              <g key={m.label}>
                <line x1={x(m.age)} x2={x(m.age)} y1={pad.t} y2={H - pad.b} className={"en-marker " + m.cls} />
                <text x={x(m.age) + (end ? -5 : 5)} y={pad.t + 12 + row * 16} textAnchor={end ? "end" : "start"} className={"en-marker-label " + m.cls}>
                  {m.label} ({m.age})
                </text>
              </g>
            );
          })}
        {series.filter((l) => l.area).map((l) => (
          <path key={l.key + "-area"} d={area(l.key)} className={l.cls + " en-area"} />
        ))}
        {series.map((l) => (
          <path key={l.key} d={path(l.key)} className={l.cls} fill="none" />
        ))}
        {hp && (
          <g>
            <line x1={x(hp.age)} x2={x(hp.age)} y1={pad.t} y2={H - pad.b} className="en-cross" />
            {series.map((l) => (
              <circle key={l.key} cx={x(hp.age)} cy={y(hp[l.key])} r={4} className={l.cls + " en-dot"} />
            ))}
          </g>
        )}
      </svg>
      {hp && (
        <div className="en-tipbox" style={{ left: `${(x(hp.age) / W) * 100}%` }}>
          <b>גיל {hp.age}</b>
          {series.map((l) => (
            <span key={l.key}><i className={"en-sw " + l.cls} />{l.label}: <b className="num">{short(hp[l.key])}</b></span>
          ))}
        </div>
      )}
    </div>
  );
}

function Legend({ items }: { items: { label: string; cls: string }[] }) {
  return (
    <div className="en-legend">
      {items.map((i) => (
        <span key={i.label}><i className={"en-sw " + i.cls} />{i.label}</span>
      ))}
    </div>
  );
}

// A whole-number field that lets you clear and retype (a plain controlled number input snaps
// back to 0 on every keystroke). Commits only when the text is a valid number.
function NumInput({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <input
      inputMode="numeric"
      value={draft ?? String(value)}
      onChange={(e) => {
        const t = e.target.value;
        setDraft(t);
        const n = Number(t.replace(/[,\s]/g, ""));
        if (t.trim() !== "" && Number.isFinite(n)) onChange(n);
      }}
      onBlur={() => setDraft(null)}
    />
  );
}

export function EnoughClient({ base: inv, initial }: { base: InventoryBase; initial: Assumptions }) {
  const [a, setA] = useState<Assumptions>(initial);
  const [scenario, setScenario] = useState<Scenario>(SCENARIOS.now);
  const [goalAge, setGoalAge] = useState(Math.min(90, Math.max(a.currentAge + 1, 55)));
  const [saved, setSaved] = useState(JSON.stringify(initial));
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  const set = <K extends keyof Assumptions>(k: K, v: Assumptions[K]) => setA((p) => ({ ...p, [k]: v }));

  const dirty = JSON.stringify(a) !== saved;
  const missing = inv.income == null || inv.expense == null;
  const base = useMemo(
    () => ({ liquid: Math.max(0, inv.liquid - (a.deductEmergency ? inv.emergency : 0)), income: inv.income ?? 0, expense: inv.expense ?? 0 }),
    [inv, a.deductEmergency],
  );
  const r = useMemo(() => simulate(base, a, scenario), [base, a, scenario]);
  const goal = useMemo(() => goalSeek(base, a, scenario, goalAge), [base, a, scenario, goalAge]);

  function pick(key: string) {
    const s = SCENARIOS[key];
    setScenario({ incomeLoss: s.incomeLoss, expenseAdjust: s.expenseAdjust });
    if (s.roi != null) setA((p) => ({ ...p, roi: s.roi!, inflation: s.inflation! }));
  }
  function save() {
    setMsg("");
    start(async () => {
      try {
        await saveSimSettings(a);
        setSaved(JSON.stringify(a));
        setMsg("נשמר");
      } catch {
        setMsg("השמירה נכשלה. ודאו שהמיגרציה האחרונה הורצה (npm run db:finance:migrate).");
      }
    });
  }
  const setEvent = (i: number, patch: Partial<CapitalEvent>) => set("events", a.events.map((e, j) => (j === i ? { ...e, ...patch } : e)));

  const ok = r.survives && r.lowest >= 0;
  const markers: Marker[] = [
    { age: a.retirementAge, label: "פרישה", cls: "m-ret" },
    ...(r.fiAge ? [{ age: r.fiAge, label: "חופש כלכלי", cls: "m-fi" }] : []),
  ];
  return (
    <div className="fin enough" dir="rtl">
      <div className="wrap">
        <h1>כמה זה מספיק?</h1>
        <p className="sub">תחזית ההון הנזיל עד גיל {END_AGE}, לפי כלל ה-{a.rule}: הון בגובה {a.rule} חודשי מחיה מאפשר למשוך כ-4% בשנה בלי לגעת בקרן.</p>

        {!inv.hasRows ? (
          <div className="fcard">עדיין אין מלאי. <Link href="/finance">מלאו אותו קודם</Link> והסימולטור יתחיל ממנו.</div>
        ) : (
          missing && <div className="fcard en-warn">⚠ חסר פרמטר &quot;הכנסה חודשית נטו&quot; או &quot;הוצאה חודשית&quot; במלאי, והחישוב מניח 0. <Link href="/finance">הוסיפו אותם במלאי</Link>.</div>
        )}

        <div className="en-kpis en-results">
          <Kpi label={`הון בפרישה (גיל ${a.retirementAge})`} help={HELP.atRetirement} value={r.atRetirement == null ? "—" : short(r.atRetirement)} />
          <Kpi label="יעד חופש כלכלי בפרישה" help={HELP.fiTarget} value={r.fiTargetAtRetirement == null ? "—" : short(r.fiTargetAtRetirement)} />
          <Kpi label="הגעה לחופש כלכלי" help={HELP.fiAge} value={r.fiAge ? `גיל ${r.fiAge}` : "לא הושג"} cls={r.fiAge ? "good" : "bad"} />
          <Kpi label="נקודת השפל" help={HELP.lowest} value={`${short(r.lowest)} · גיל ${r.lowestAge}`} cls={r.lowest < 0 ? "bad" : ""} />
        </div>
        <p className={"en-verdict " + (ok ? "good" : "bad")}>
          {ok ? `✓ ההון מחזיק עד גיל ${END_AGE} אם פורשים בגיל ${a.retirementAge}.` : `✕ ההון אוזל לפני גיל ${END_AGE} אם פורשים בגיל ${a.retirementAge}.`}
        </p>

        <div className="en-layout">
          <aside className="en-panel fcard" aria-label="הנחות ותרחישים">
            <h2>שחקו עם הנתונים</h2>
            <div className="en-chips">
              {Object.entries(SCENARIOS).map(([k, s]) => (
                <span key={k} className="en-chip">
                  <button type="button" onClick={() => pick(k)}>{s.label}</button>
                  <Info text={HELP[("s_" + k) as keyof typeof HELP]} />
                </span>
              ))}
            </div>

            <dl className="en-base-list">
              <div><dt>הון נזיל <Info text={HELP.liquid} /></dt><dd className="num">{short(base.liquid)}</dd></div>
              <div><dt>הכנסה חודשית <Info text={HELP.income} /></dt><dd className="num">{ils(r.monthlyIncome)}</dd></div>
              <div><dt>הוצאה חודשית <Info text={HELP.expense} /></dt><dd className="num">{ils(r.monthlyExpense)}</dd></div>
              <div><dt>עודף חודשי <Info text={HELP.surplus} /></dt><dd className={"num " + (r.surplus < 0 ? "bad" : "good")}>{ils(r.surplus)}</dd></div>
            </dl>

            <div className="en-sliders">
              <Slider label="ירידה בהכנסה" help={HELP.incomeLoss} value={scenario.incomeLoss} min={0} max={35000} step={1000} fmt={ils} onChange={(v) => setScenario((s) => ({ ...s, incomeLoss: v }))} />
              <Slider label="התאמת הוצאה חודשית" help={HELP.expenseAdjust} value={scenario.expenseAdjust} min={-10000} max={20000} step={500} fmt={ils} onChange={(v) => setScenario((s) => ({ ...s, expenseAdjust: v }))} />
              <Slider label="תשואה שנתית נטו" help={HELP.roi} value={a.roi} min={1} max={15} step={0.5} fmt={(n) => n + "%"} onChange={(v) => set("roi", v)} />
              <Slider label="גיל פרישה" help={HELP.retirementAge} value={a.retirementAge} min={40} max={90} step={1} onChange={(v) => set("retirementAge", v)} />
              <Slider label="כיסוי פנסיוני מההכנסה" help={HELP.pensionRatio} value={a.pensionRatio} min={0} max={100} step={1} fmt={(n) => n + "%"} onChange={(v) => set("pensionRatio", v)} />
            </div>
            {a.roi >= 15 && <p className="en-warn">⚠ תשואה של {a.roi}% לאורך זמן נראית לא סבירה.</p>}

            <details className="en-more">
              <summary>עוד הנחות</summary>
              <div className="en-sliders">
                <Slider label="אינפלציה שנתית" help={HELP.inflation} value={a.inflation} min={0} max={6} step={0.5} fmt={(n) => n + "%"} onChange={(v) => set("inflation", v)} />
                <Slider label="גיל נוכחי" help={HELP.currentAge} value={a.currentAge} min={20} max={80} step={1} onChange={(v) => set("currentAge", v)} />
                <Slider label="גיל תחילת פנסיה" help={HELP.pensionAge} value={a.pensionAge} min={55} max={75} step={1} onChange={(v) => set("pensionAge", v)} />
                <Slider label="זחילת רמת חיים" help={HELP.creep} value={a.lifestyleCreep} min={0} max={5} step={0.5} fmt={(n) => n + "%"} onChange={(v) => set("lifestyleCreep", v)} />
                <Slider label="גידול ריאלי בשכר" help={HELP.incomeGrowth} value={a.incomeGrowth} min={0} max={5} step={0.5} fmt={(n) => n + "%"} onChange={(v) => set("incomeGrowth", v)} />
              </div>
              <label className="en-check"><input type="checkbox" checked={a.workAfterRetirement} onChange={(e) => set("workAfterRetirement", e.target.checked)} /><span>עבודה נמשכת אחרי הפרישה <Info text={HELP.workAfter} /></span></label>
              <label className="en-check"><input type="checkbox" checked={a.glidePath} onChange={(e) => set("glidePath", e.target.checked)} /><span>הפחתת סיכון הדרגתית (8% ואז 4%) <Info text={HELP.glide} /></span></label>
              <label className="en-check"><input type="checkbox" checked={a.deductEmergency} onChange={(e) => set("deductEmergency", e.target.checked)} /><span>לנכות קרן חירום ({short(inv.emergency)}) <Info text={HELP.deduct} /></span></label>
            </details>

            <div className="en-save">
              <button type="button" className="primary" disabled={!dirty || pending} onClick={save}>{pending ? "שומר..." : "שמירת ההנחות"}</button>
              <span className="muted small">{dirty ? "יש שינויים שלא נשמרו" : msg}</span>
            </div>
            <p className="muted small">ירידה בהכנסה והתאמת הוצאה הן תרחיש ולא נשמרות. שאר ההנחות נשמרות לשניכם.</p>
          </aside>

          <div className="en-charts">
            <section className="fcard">
              <div className="en-card-head">
                <h2>הון נזיל לפי גיל <Info text={HELP.chartBalance} /></h2>
                <Legend items={[{ label: "הון נזיל", cls: "s-bal" }, { label: "יעד חופש כלכלי", cls: "s-fi" }]} />
              </div>
              <Chart
                label="תחזית ההון הנזיל לפי גיל"
                points={r.timeline.map((t) => ({ age: t.age, balance: t.balance, fi: t.fiTarget }))}
                series={[
                  { key: "fi", label: "יעד", cls: "s-fi" },
                  { key: "balance", label: "הון", cls: "s-bal", area: true },
                ]}
                markers={markers}
              />
            </section>

            <section className="fcard">
              <div className="en-card-head">
                <h2>הכנסה והוצאה חודשית <Info text={HELP.chartFlow} /></h2>
                <Legend items={[{ label: "הכנסה", cls: "s-inc" }, { label: "הוצאה", cls: "s-exp" }]} />
              </div>
              <Chart
                label="הכנסה והוצאה חודשית ממוצעת לפי גיל"
                points={r.timeline.map((t) => ({ age: t.age, income: t.monthlyIncome, expense: t.monthlyExpense }))}
                series={[
                  { key: "income", label: "הכנסה", cls: "s-inc" },
                  { key: "expense", label: "הוצאה", cls: "s-exp" },
                ]}
                markers={markers.filter((m) => m.cls === "m-ret")}
              />
            </section>
          </div>
        </div>

        <div className="fcard">
          <h2>ילדים ואירועי הון</h2>
          <div className="en-row">
            <label>גילאי הילדים (מופרדים בפסיק) <Info text={HELP.children} />
              <input
                key={a.childrenAges.length}
                defaultValue={a.childrenAges.join(", ")}
                placeholder="למשל 6, 9"
                onBlur={(e) => set("childrenAges", e.target.value.split(/[,\s]+/).map(Number).filter((n) => Number.isFinite(n) && n >= 0 && n <= 60 && e.target.value.trim() !== "").slice(0, 10))}
              />
            </label>
            <label>חלק הילדים בהוצאה החודשית (₪) <Info text={HELP.kids} />
              <input type="number" min={0} step={100} value={a.kidsMonthly} onChange={(e) => set("kidsMonthly", Math.max(0, Number(e.target.value) || 0))} />
            </label>
          </div>
          <p className="muted small">התקציב מתחלק שווה בין הילדים; חלקו של כל ילד יורד בחצי בגיל 18 ונעלם בגיל 21.</p>
          <table className="en-events">
            <thead><tr><th>אירוע <Info text={HELP.events} /></th><th>גיל</th><th>סוג</th><th>סכום (₪)</th><th /></tr></thead>
            <tbody>
              {a.events.map((e, i) => {
                const outside = e.age < a.currentAge || e.age > END_AGE;
                return (
                  <tr key={i}>
                    <td><input value={e.desc} placeholder="למשל שיפוץ" onChange={(ev) => setEvent(i, { desc: ev.target.value })} /></td>
                    <td>
                      <NumInput value={e.age} onChange={(n) => setEvent(i, { age: Math.round(n) })} />
                      {outside && <span className="en-warn small">מחוץ לתחזית ({a.currentAge}-{END_AGE}), לא ישפיע</span>}
                    </td>
                    <td>
                      <select value={e.amount < 0 ? "out" : "in"} onChange={(ev) => setEvent(i, { amount: (ev.target.value === "out" ? -1 : 1) * Math.abs(e.amount) })}>
                        <option value="in">כסף נכנס</option>
                        <option value="out">הוצאה</option>
                      </select>
                    </td>
                    <td>
                      <NumInput value={Math.abs(e.amount)} onChange={(n) => setEvent(i, { amount: (e.amount < 0 ? -1 : 1) * Math.abs(n) })} />
                      {e.amount === 0 && <span className="muted small">הזינו סכום</span>}
                    </td>
                    <td><button type="button" aria-label="מחיקה" onClick={() => set("events", a.events.filter((_, j) => j !== i))}>×</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <button type="button" className="en-add" onClick={() => set("events", [...a.events, { desc: "", age: Math.min(90, a.currentAge + 5), amount: -100000 }])}>+ הוסף אירוע</button>
        </div>

        <div className="fcard">
          <h2>הנדסה לאחור: איך מקדימים את הפרישה?</h2>
          <Slider label="גיל יעד לפרישה" help={HELP.goalAge} value={goalAge} min={Math.max(a.currentAge, 40)} max={75} step={1} onChange={setGoalAge} />
          {goal.years <= 0 ? (
            <p>בחרו גיל יעד מאוחר מהגיל הנוכחי.</p>
          ) : (
            <p>
              כדי להגיע לחופש כלכלי בגיל <b>{goalAge}</b> (בעוד {goal.years} שנים, יעד {short(goal.target)}):<br />
              1. להגדיל את החיסכון החודשי ל-<b className="num">{ils(Math.max(0, goal.surplus))}</b>.<br />
              2. או להשיג תשואה שנתית של <b className="num">{goal.roi.toFixed(2)}%</b>
              {goal.roi > 12 && <span className="bad"> (לא ריאלי ללא סיכון)</span>}.
            </p>
          )}
        </div>

      </div>
    </div>
  );
}
