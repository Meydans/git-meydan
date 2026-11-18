"use client";

import Link from "next/link";
import { Info as InfoIcon } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, useTransition } from "react";
import { saveSimSettings } from "@/app/(finance)/finance/actions";
import { parseSettingsFile, settingsFile } from "@/lib/finance/fields";
import type { InventoryBase } from "@/lib/finance/inventory";
import { analysisReport } from "@/lib/finance/report";
import { END_AGE, earliestRetirement, goalSeek, monthlyPension, PENSION_FACTOR, simulate, withAge, type Assumptions, type CapitalEvent, type IncomeChange, type Scenario } from "@/lib/finance/simulator";
import "./finance.css";
import "./enough.css";

const ils = (n: number) => "₪" + Math.round(n).toLocaleString("he-IL");
const signed = (n: number) => (n > 0 ? "+" : n < 0 ? "-" : "") + ils(Math.abs(n));
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
  fiTarget: "כלל ה-300: הון בגובה 300 פעמים החלק מההוצאה החודשית שהפנסיה לא מכסה (מאפשר למשוך כ-4% בשנה בלי לפגוע בקרן). לפני גיל הפנסיה נוסף \"גשר\": החלק שהפנסיה תכסה, כפול מספר החודשים עד שהיא מתחילה. בערכי אותה שנה, כולל אינפלציה.",
  fiAge: "הגיל הראשון, אחרי שנת ההתחלה, שבו ההון הנזיל מגיע ליעד החופש הכלכלי. אם הוא לא מגיע עד גיל 90, כתוב \"לא הושג\". זה מבחן מחמיר יותר מ\"ההון מחזיק עד 90\": יעד ה-300 מכוון להון שמחזיק לתמיד, ולכן אפשר לא להגיע לחופש כלכלי ועדיין שההון יחזיק עד 90.",
  lowest: "אם ההון נגמר: הגיל שבו הוא יורד מתחת לאפס. אם לא: הנקודה הנמוכה ביותר שאליה הוא יורד. אחרי שההון נגמר, החוסר לא צובר תשואה, כך שהמספרים השליליים בגרף הם החוסר המצטבר ולא חוב שגדל בריבית.",
  earliest: "הגיל המוקדם ביותר לפרישה שבו ההון לא נגמר עד גיל 90, לפי כל ההנחות (פנסיה, ילדים, אירועים, שינויים בהכנסה).",
  incomeChange: "שינוי בהכנסה החודשית מהיום: שלילי לירידה (למשל חצי משרה), חיובי לעלייה (למשל העלאה). זה תרחיש לבדיקה ולא נשמר. לשינוי שמתחיל בגיל מסוים, הוסיפו אותו ב\"שינויים עתידיים בהכנסה\".",
  incomeChanges: "הכנסה חודשית שמתחילה בגיל מסוים ונמשכת עד הפרישה או עד גיל שתבחרו. למשל: משכורת של אפרת, 10,000 ₪ בחודש מגיל 43. הסכום בכסף של היום, והוא עולה עם האינפלציה והגידול בשכר. סכום שלילי מתאים להכנסה שנפסקת. לא משנה את הפנסיה.",
  expenseAdjust: "סכום שמתווסף להוצאה החודשית (או מופחת ממנה, אם שלילי). תרחיש בלבד, לא נשמר.",
  roi: "התשואה השנתית הממוצעת שמניחים על ההון הנזיל, נטו אחרי דמי ניהול ומס. תשואה גבוהה מאוד נראית טוב בגרף אבל לא סבירה לאורך שנים.",
  inflation: "קצב העלייה השנתי במחירים. ההוצאה ושכר העבודה עולים בקצב הזה בכל שנה.",
  currentAge: "הגיל שממנו התחזית מתחילה לרוץ קדימה. כשמזינים שנת לידה, הגיל מחושב ממנה ומתעדכן לבד כל שנה.",
  retirementAge: "הגיל שבו ההכנסה מעבודה נפסקת (אלא אם סימנתם שהיא נמשכת). מאותו גיל מושכים מהון.",
  pensionAge: "הגיל שבו מתחילה להיכנס קצבת הפנסיה החודשית.",
  pension: "הקצבה החודשית שכל אחד מכם צפוי לקבל מגיל הפנסיה, בכסף של היום. לוקחים אותה מהדוח השנתי של קרן הפנסיה, בשורה \"קצבה חודשית צפויה בגיל פרישה\" (או מהר הכסף). המספר הזה כבר כולל את ההפקדות שתמשיכו להפקיד עד הפרישה. כספי הפנסיה עצמם לא נכנסים להון הנזיל, כי אי אפשר למשוך אותם לפני הפרישה: הם משפיעים רק דרך הקצבה, שצמודה לאינפלציה. מתחת לכל שדה: בדיקת סבירות. הצבירה של היום חלקי 200 (מקדם ההמרה המקובל בקרנות פנסיה בגיל 67). זו הקצבה שהצבירה הנוכחית קונה לבדה, בלי הפקדות ותשואה עתידיות, ולכן הקצבה בדוח השנתי אמורה להיות גבוהה ממנה.",
  creep: "העלייה השנתית בהוצאות שמעבר לאינפלציה, בגלל שדרוג רמת החיים. 0% אומר שרמת החיים נשארת אותה רמה.",
  incomeGrowth: "העלייה השנתית בשכר שמעבר לאינפלציה (קידום, העלאות). 0% אומר שהשכר רק עוקב אחרי האינפלציה.",
  workAfter: "אם מסומן, ההכנסה מעבודה ממשיכה גם אחרי גיל הפרישה (למשל עבודה חלקית). אם לא, ההכנסה היחידה אחרי הפרישה היא הפנסיה.",
  glide: "מודל הפחתת סיכון: 8% תשואה ב-10 השנים הראשונות, ואז 4% לשמירה על ההון. כשמסומן הוא מחליף את סליידר התשואה.",
  children: "תקציב הילדים משתנה עם הגיל. משקל לכל ילד: עד גיל 10 = 1, מגיל 10 עד 18 = 1.8 (ילד גדול עולה בערך פי 1.8, לפי מחקר של קרלינסקי ושראל, בנק ישראל 2020, על נתוני סקר ההוצאות של הלמ\"ס), בשירות הצבאי 18-21 = 0.6 (כשליש מגיל ההתבגרות, לפי סקר מרכז המחקר של הכנסת 2018 ונוהג בתי המשפט), ומגיל 21 = 0. התקציב של היום מוכפל ביחס בין סכום המשקלות בכל שנה לסכום של היום.",
  kids: "כמה מההוצאה החודשית הכוללת הולך היום לילדים (גן, חוגים, בגדים, אוכל שלהם וכו'). הסכום עולה כשילד עובר את גיל 10, יורד בשירות הצבאי ונגמר בגיל 21.",
  adultSupport: "תמיכה חודשית קבועה בכל ילד אחרי הצבא (סטודנט, שכר דירה). בסקרים בישראל, הורים שתומכים בילדים בוגרים נותנים בממוצע כ-2,100 ₪ בחודש. בכסף של היום. 0 = בלי תמיכה.",
  adultSupportUntil: "הגיל של הילד שבו התמיכה החודשית נגמרת.",
  events: "הכנסה או הוצאה חד-פעמית בגיל מסוים, כמו קרן השתלמות שנפתחת (חיובי), שיפוץ, טיול אחרי צבא, רישיון, עזרה בדירה או חתונה (שלילי). הסכום בכסף של היום, והוא עולה עם האינפלציה עד שנת האירוע.",
  file: "\"ייצוא לניתוח\" מוריד קובץ Markdown קריא: נקודת הפתיחה, כל ההנחות ביחידות שלהן, כללי החישוב, התוצאות והתחזית השנתית, כדי שאדם או כלי AI יבינו את התמונה בלי הקוד. \"ייצוא לקובץ\" שומר את כל ההגדרות: ההנחות, הילדים, אירועי ההון, השינויים בהכנסה וגם הסליידרים של התרחיש. טעינה מחליפה את הערכים בדף, וצריך ללחוץ שמירה כדי שיישמרו לשניכם. הקובץ מכיל את המספרים האישיים שלכם, שמרו אותו במקום פרטי.",
  goalAge: "פורשים בגיל הזה, וההון צריך להחזיק עד גיל 90. החישוב רץ על המודל המלא ומראה מה נדרש: חיסכון חודשי נוסף מהיום ועד הפרישה (בכסף של היום), או תשואה שנתית גבוהה יותר.",
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
  now: { label: "מצב נוכחי", incomeChange: 0, expenseAdjust: 0 },
  good: { label: "אופטימי", incomeChange: 0, expenseAdjust: -2000, roi: 9, inflation: 1.5 },
  safe: { label: "שמרני", incomeChange: 0, expenseAdjust: 2500, roi: 4, inflation: 3 },
  crisis: { label: "משבר", incomeChange: -15000, expenseAdjust: 6000, roi: 2, inflation: 4 },
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
function NumInput({ value, onChange, placeholder }: { value: number | null; onChange: (n: number) => void; placeholder?: string }) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <input
      inputMode="numeric"
      value={draft ?? (value == null ? "" : String(value))}
      placeholder={placeholder}
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
  const [a, setA] = useState<Assumptions>(() => withAge(initial));
  const [scenario, setScenario] = useState<Scenario>(SCENARIOS.now);
  const [goalAge, setGoalAge] = useState(Math.min(90, Math.max(a.currentAge + 1, 55)));
  const [saved, setSaved] = useState(() => JSON.stringify(withAge(initial)));
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  const set = <K extends keyof Assumptions>(k: K, v: Assumptions[K]) => {
    setMsg("");
    setA((p) => ({ ...p, [k]: v }));
  };

  const dirty = JSON.stringify(a) !== saved;
  const missing = inv.income == null || inv.expense == null;
  const base = useMemo(
    () => ({ liquid: Math.max(0, inv.liquid - (a.deductEmergency ? inv.emergency : 0)), income: inv.income ?? 0, expense: inv.expense ?? 0 }),
    [inv, a.deductEmergency],
  );
  const r = useMemo(() => simulate(base, a, scenario), [base, a, scenario]);
  const goal = useMemo(() => goalSeek(base, a, scenario, goalAge), [base, a, scenario, goalAge]);
  const earliest = useMemo(() => earliestRetirement(base, a, scenario), [base, a, scenario]);

  function pick(key: string) {
    const s = SCENARIOS[key];
    setScenario({ incomeChange: s.incomeChange, expenseAdjust: s.expenseAdjust });
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
  // The whole picture (saved plan + what-if sliders) to a JSON file, and back. A loaded file
  // replaces the page's values; it is saved only when you press save.
  function exportFile() {
    const blob = new Blob([JSON.stringify(settingsFile(a, scenario), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `kama-ze-maspik-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }
  function download(text: string, name: string, type: string) {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    link.click();
    URL.revokeObjectURL(url);
  }
  // A readable Markdown picture (data, assumptions, rules, results) for a person or an AI tool.
  function exportReport() {
    const report = analysisReport({
      base,
      liquidTotal: inv.liquid,
      emergency: inv.emergency,
      pensionSavings: inv.pensionSavings,
      incomeMissing: inv.income == null,
      expenseMissing: inv.expense == null,
      assumptions: a,
      scenario,
      goalAge,
    });
    download(report, `kama-ze-maspik-analysis-${new Date().toISOString().slice(0, 10)}.md`, "text/markdown;charset=utf-8");
  }
  async function importFile(file: File | undefined) {
    if (!file) return;
    const r = parseSettingsFile(await file.text());
    if (!r.ok) {
      setMsg(r.error);
      return;
    }
    setA(withAge(r.assumptions));
    setScenario(r.scenario);
    setMsg("ההגדרות נטענו מהקובץ. לחצו שמירה כדי לשמור אותן.");
  }
  // One field per pension owner in the inventory (plus any already saved), or a single one.
  const pensionWho = [...new Set([...inv.pensionSavings.map((p) => p.who), ...(a.pensions ?? []).map((p) => p.who)])];
  if (!pensionWho.length) pensionWho.push("");
  const setPension = (who: string, monthly: number) =>
    set("pensions", pensionWho.map((w) => ({ who: w, monthly: w === who ? Math.max(0, monthly) : (a.pensions?.find((p) => p.who === w)?.monthly ?? 0) })));
  const setChange = (i: number, patch: Partial<IncomeChange>) => set("incomeChanges", a.incomeChanges.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  const setEvent = (i: number, patch: Partial<CapitalEvent>) => set("events", a.events.map((e, j) => (j === i ? { ...e, ...patch } : e)));

  const ok = r.survives;
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
          {r.depletionAge != null ? (
            <Kpi label="ההון נגמר" help={HELP.lowest} value={`בגיל ${r.depletionAge}`} cls="bad" />
          ) : (
            <Kpi label="נקודת השפל" help={HELP.lowest} value={`${short(r.lowest)} · גיל ${r.lowestAge}`} />
          )}
          <Kpi label="פרישה מוקדמת שמחזיקה" help={HELP.earliest} value={earliest != null ? `גיל ${earliest}` : "אין עד 90"} cls={earliest != null ? "good" : "bad"} />
        </div>
        <p className={"en-verdict " + (ok ? "good" : "bad")}>
          {ok
            ? `✓ ההון מחזיק עד גיל ${END_AGE} אם פורשים בגיל ${a.retirementAge}.`
            : `✕ אם פורשים בגיל ${a.retirementAge}, ההון נגמר בגיל ${r.depletionAge}.`}
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
              <Slider label="שינוי בהכנסה" help={HELP.incomeChange} value={scenario.incomeChange} min={-35000} max={20000} step={500} fmt={signed} onChange={(v) => setScenario((s) => ({ ...s, incomeChange: v }))} />
              <Slider label="התאמת הוצאה חודשית" help={HELP.expenseAdjust} value={scenario.expenseAdjust} min={-10000} max={20000} step={500} fmt={ils} onChange={(v) => setScenario((s) => ({ ...s, expenseAdjust: v }))} />
              <Slider label="תשואה שנתית נטו" help={HELP.roi} value={a.roi} min={1} max={15} step={0.5} fmt={(n) => n + "%"} onChange={(v) => set("roi", v)} />
              <Slider label="גיל פרישה" help={HELP.retirementAge} value={a.retirementAge} min={40} max={90} step={1} onChange={(v) => set("retirementAge", v)} />
            </div>
            <div className="en-pension">
              <div className="en-ctl-top">
                <span>קצבה חודשית צפויה <Info text={HELP.pension} /></span>
                <b className="num">{ils(monthlyPension(a, r.monthlyIncome))}</b>
              </div>
              {pensionWho.map((who) => {
                const bal = inv.pensionSavings.find((p) => p.who === who)?.balance;
                return (
                  <label key={who} className="en-pen-row">
                    <span>{who || "קצבה"}</span>
                    <NumInput value={a.pensions?.find((p) => p.who === who)?.monthly || null} placeholder="מהדוח השנתי" onChange={(n) => setPension(who, n)} />
                    {bal != null && (
                      <span className="muted small">
                        צבירה {short(bal)} · לבדה ≈ {ils(bal / PENSION_FACTOR)} לחודש
                      </span>
                    )}
                  </label>
                );
              })}
              {a.pensions == null ? (
                <p className="en-warn small">עוד לא הוזנה קצבה מהדוח השנתי, ולכן מניחים {a.pensionRatio}% מההכנסה של היום.</p>
              ) : (
                <button type="button" className="en-link small" onClick={() => set("pensions", null)}>חזרה להערכה לפי {a.pensionRatio}% מההכנסה</button>
              )}
            </div>
            {a.roi >= 15 && <p className="en-warn">⚠ תשואה של {a.roi}% לאורך זמן נראית לא סבירה.</p>}

            <details className="en-more">
              <summary>עוד הנחות</summary>
              <div className="en-sliders">
                <Slider label="אינפלציה שנתית" help={HELP.inflation} value={a.inflation} min={0} max={6} step={0.5} fmt={(n) => n + "%"} onChange={(v) => set("inflation", v)} />
                <label className="en-ctl">
                  <span className="en-ctl-top">
                    <span>שנת לידה <Info text={HELP.currentAge} /></span>
                    <b className="num">גיל {a.currentAge}</b>
                  </span>
                  <NumInput
                    value={a.birthYear ?? new Date().getFullYear() - a.currentAge}
                    onChange={(n) => {
                      const y = Math.round(n);
                      if (y >= 1930 && y <= 2010) setA((p) => withAge({ ...p, birthYear: y }));
                    }}
                  />
                </label>
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
              <span className="muted small">{msg || (dirty ? "יש שינויים שלא נשמרו" : "")}</span>
            </div>
            <p className="muted small">שינוי בהכנסה והתאמת הוצאה הם תרחיש ולא נשמרים. שאר ההנחות נשמרות לשניכם.</p>
            <div className="en-file">
              <button type="button" onClick={exportFile}>ייצוא לקובץ</button>
              <label className="en-file-in">
                טעינה מקובץ
                <input type="file" accept="application/json,.json" onChange={(e) => { void importFile(e.target.files?.[0]); e.target.value = ""; }} />
              </label>
              <button type="button" onClick={exportReport}>ייצוא לניתוח (AI)</button>
              <Info text={HELP.file} />
            </div>
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

            <section className="fcard">
              <div className="en-card-head">
                <h2>שינויים עתידיים בהכנסה <Info text={HELP.incomeChanges} /></h2>
              </div>
              {a.incomeChanges.length > 0 && (
                <table className="en-events">
                  <thead><tr><th>תיאור</th><th>סוג</th><th>סכום חודשי (₪)</th><th>מגיל</th><th>עד</th><th /></tr></thead>
                  <tbody>
                    {a.incomeChanges.map((c, i) => (
                      <tr key={i}>
                        <td><input value={c.desc} placeholder="למשל משכורת של אפרת" onChange={(ev) => setChange(i, { desc: ev.target.value })} /></td>
                        <td>
                          <select value={c.monthly < 0 ? "out" : "in"} onChange={(ev) => setChange(i, { monthly: (ev.target.value === "out" ? -1 : 1) * Math.abs(c.monthly) })}>
                            <option value="in">הכנסה נוספת</option>
                            <option value="out">הכנסה שנפסקת</option>
                          </select>
                        </td>
                        <td><NumInput value={Math.abs(c.monthly)} onChange={(n) => setChange(i, { monthly: (c.monthly < 0 ? -1 : 1) * Math.abs(n) })} /></td>
                        <td>
                          <NumInput value={c.fromAge} onChange={(n) => setChange(i, { fromAge: Math.round(n) })} />
                          {(c.fromAge < a.currentAge || c.fromAge > END_AGE) && <span className="en-warn small">מחוץ לתחזית</span>}
                        </td>
                        <td>
                          <select
                            value={c.toAge == null ? "ret" : "age"}
                            onChange={(ev) => setChange(i, { toAge: ev.target.value === "ret" ? null : Math.max(c.fromAge + 1, a.retirementAge) })}
                          >
                            <option value="ret">הפרישה ({a.retirementAge})</option>
                            <option value="age">גיל מסוים</option>
                          </select>
                          {c.toAge != null && <NumInput value={c.toAge} onChange={(n) => setChange(i, { toAge: Math.round(n) })} />}
                        </td>
                        <td><button type="button" aria-label="מחיקה" onClick={() => set("incomeChanges", a.incomeChanges.filter((_, j) => j !== i))}>×</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <button
                type="button"
                className="en-add"
                onClick={() => set("incomeChanges", [...a.incomeChanges, { desc: "", monthly: 10000, fromAge: Math.min(90, a.currentAge + 2), toAge: null }])}
              >
                + הוסף שינוי בהכנסה
              </button>
              <p className="muted small">השינוי נראה בגרף ההכנסה וההוצאה. הסכום בכסף של היום.</p>
            </section>

            <section className="fcard">
              <h2>ילדים ואירועי הון</h2>
              <div className="en-row">
                <label>
                  <span className="en-lbl">גילאי הילדים (מופרדים בפסיק) <Info text={HELP.children} /></span>
                  <input
                    key={a.childrenAges.length}
                    defaultValue={a.childrenAges.join(", ")}
                    placeholder="למשל 6, 9"
                    onBlur={(e) => set("childrenAges", e.target.value.split(/[,\s]+/).map(Number).filter((n) => Number.isFinite(n) && n >= 0 && n <= 60 && e.target.value.trim() !== "").slice(0, 10))}
                  />
                </label>
                <label>
                  <span className="en-lbl">חלק הילדים בהוצאה החודשית היום (₪) <Info text={HELP.kids} /></span>
                  <NumInput value={a.kidsMonthly} onChange={(n) => set("kidsMonthly", Math.max(0, n))} />
                </label>
                <label>
                  <span className="en-lbl">תמיכה חודשית בכל ילד אחרי 21 (₪) <Info text={HELP.adultSupport} /></span>
                  <NumInput value={a.adultSupport} onChange={(n) => set("adultSupport", Math.max(0, n))} />
                </label>
                <label>
                  <span className="en-lbl">התמיכה נגמרת בגיל <Info text={HELP.adultSupportUntil} /></span>
                  <NumInput value={a.adultSupportUntil} onChange={(n) => set("adultSupportUntil", Math.min(40, Math.max(21, Math.round(n))))} />
                </label>
              </div>
              <p className="muted small">משקל לפי גיל: עד 10 = 1, 10-18 = 1.8, צבא 18-21 = 0.6, מ-21 = 0 (מקורות ב-i). סכומי אירועים הם בכסף של היום.</p>
              <table className="en-events">
                <thead><tr><th>אירוע <Info text={HELP.events} /></th><th>גיל</th><th>סוג</th><th>סכום (₪, בכסף של היום)</th><th /></tr></thead>
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
            </section>
          </div>
        </div>

        <div className="fcard">
          <h2>הנדסה לאחור: איך מקדימים את הפרישה?</h2>
          <Slider label="גיל יעד לפרישה" help={HELP.goalAge} value={goalAge} min={Math.max(a.currentAge, 40)} max={75} step={1} onChange={setGoalAge} />
          {goal.years <= 0 ? (
            <p>בחרו גיל יעד מאוחר מהגיל הנוכחי.</p>
          ) : goal.alreadyOk ? (
            <p className="good">✓ פרישה בגיל {goalAge} כבר מחזיקה עד גיל {END_AGE} עם ההנחות הנוכחיות.</p>
          ) : (
            <div>
              <p>כדי לפרוש בגיל <b>{goalAge}</b> (בעוד {goal.years} שנים) וההון יחזיק עד גיל {END_AGE}, צריך אחד מאלה:</p>
              <p>
                1.{" "}
                {goal.extraSaving == null ? (
                  <span className="bad">חיסכון נוסף לא מספיק גם ב-200 אלף ₪ בחודש.</span>
                ) : (
                  <>
                    לחסוך עוד <b className="num">{ils(goal.extraSaving)}</b> בחודש (בכסף של היום) מהיום ועד הפרישה
                    {goal.extraSaving > goal.income && <span className="bad"> — יותר מכל ההכנסה החודשית, כלומר לא ריאלי</span>}.
                  </>
                )}
                <br />
                2.{" "}
                {goal.roi == null ? (
                  <span className="bad">גם תשואה של 30% בשנה לא מספיקה.</span>
                ) : (
                  <>
                    או להשיג תשואה שנתית של <b className="num">{goal.roi.toFixed(1)}%</b>
                    {goal.roi > 10 && <span className="bad"> — לא ריאלי לאורך שנים</span>}.
                  </>
                )}
              </p>
              {earliest != null && earliest > goalAge && <p className="muted small">לשם השוואה: עם ההנחות הנוכחיות, הגיל המוקדם ביותר שמחזיק הוא {earliest}.</p>}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
