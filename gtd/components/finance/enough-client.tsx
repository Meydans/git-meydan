"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
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

function Info({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);
  return (
    <span className="en-info" ref={ref} onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        className="en-i"
        aria-label="הסבר"
        aria-expanded={open}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((o) => !o);
        }}
      >
        i
      </button>
      {open && <span role="tooltip" className="en-tip">{text}</span>}
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

function Chart({ points, lines, mark, label }: { points: Pt[]; lines: { key: string; cls: string }[]; mark?: number | null; label: string }) {
  const W = 760;
  const H = 280;
  const pad = { l: 56, r: 12, t: 12, b: 26 };
  const ys = points.flatMap((p) => lines.map((l) => p[l.key]));
  const max = Math.max(...ys, 1);
  const min = Math.min(...ys, 0);
  const x = (age: number) => pad.l + ((age - points[0].age) / Math.max(1, points[points.length - 1].age - points[0].age)) * (W - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - (v - min) / Math.max(1, max - min)) * (H - pad.t - pad.b);
  const path = (key: string) => points.map((p, i) => `${i ? "L" : "M"}${x(p.age).toFixed(1)},${y(p[key]).toFixed(1)}`).join("");
  const ticks = [min, min + (max - min) / 2, max];
  const ages = points.filter((p) => p.age % 10 === 0);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="en-chart" role="img" aria-label={label}>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} className="en-grid" />
          <text x={pad.l - 6} y={y(t) + 4} textAnchor="end" className="en-axis">{short(t)}</text>
        </g>
      ))}
      {min < 0 && <line x1={pad.l} x2={W - pad.r} y1={y(0)} y2={y(0)} className="en-zero" />}
      {ages.map((p) => (
        <text key={p.age} x={x(p.age)} y={H - 6} textAnchor="middle" className="en-axis">{p.age}</text>
      ))}
      {lines.map((l) => (
        <path key={l.key} d={path(l.key)} className={l.cls} fill="none" />
      ))}
      {mark != null && <line x1={x(mark)} x2={x(mark)} y1={pad.t} y2={H - pad.b} className="en-mark" />}
    </svg>
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

        <div className="fcard">
          <h2>נקודת פתיחה (מהמלאי)</h2>
          <div className="en-kpis">
            <Kpi label="הון נזיל" help={HELP.liquid} value={short(base.liquid)} />
            <Kpi label="הכנסה חודשית" help={HELP.income} value={ils(r.monthlyIncome)} />
            <Kpi label="הוצאה חודשית" help={HELP.expense} value={ils(r.monthlyExpense)} />
            <Kpi label="עודף חודשי" help={HELP.surplus} value={ils(r.surplus)} cls={r.surplus < 0 ? "bad" : "good"} />
          </div>
          <label className="en-check">
            <input type="checkbox" checked={a.deductEmergency} onChange={(e) => set("deductEmergency", e.target.checked)} />
            <span>לנכות את קרן החירום ({short(inv.emergency)}) מההון המושקע <Info text={HELP.deduct} /></span>
          </label>
        </div>

        <div className="fcard">
          <h2>התוצאה</h2>
          <div className="en-kpis">
            <Kpi label={`הון בפרישה (גיל ${a.retirementAge})`} help={HELP.atRetirement} value={r.atRetirement == null ? "—" : short(r.atRetirement)} />
            <Kpi label="יעד חופש כלכלי בפרישה" help={HELP.fiTarget} value={r.fiTargetAtRetirement == null ? "—" : short(r.fiTargetAtRetirement)} />
            <Kpi label="הגעה לחופש כלכלי" help={HELP.fiAge} value={r.fiAge ? `גיל ${r.fiAge} (בעוד ${r.fiYears})` : "לא הושג"} cls={r.fiAge ? "good" : "bad"} />
            <Kpi label="נקודת השפל" help={HELP.lowest} value={`${short(r.lowest)} (גיל ${r.lowestAge})`} cls={r.lowest < 0 ? "bad" : ""} />
          </div>
          <p className={"en-verdict " + (ok ? "good" : "bad")}>
            {ok ? `✓ ההון מחזיק עד גיל ${END_AGE} אם פורשים בגיל ${a.retirementAge}.` : `✕ ההון אוזל לפני גיל ${END_AGE} אם פורשים בגיל ${a.retirementAge}.`}
          </p>
          <h3 className="en-h3">הון נזיל לפי גיל <Info text={HELP.chartBalance} /></h3>
          <Chart
            label="תחזית ההון הנזיל לפי גיל"
            points={r.timeline.map((t) => ({ age: t.age, balance: t.balance, fi: t.fiTarget }))}
            lines={[{ key: "fi", cls: "en-fi" }, { key: "balance", cls: "en-bal" }]}
            mark={r.fiAge}
          />
          <div className="en-legend"><span className="l-bal">הון נזיל</span><span className="l-fi">יעד חופש כלכלי</span><span className="l-mark">נקודת ההגעה</span></div>

          <h3 className="en-h3">הכנסה והוצאה חודשית ממוצעת לפי גיל <Info text={HELP.chartFlow} /></h3>
          <Chart
            label="הכנסה והוצאה חודשית ממוצעת לפי גיל"
            points={r.timeline.map((t) => ({ age: t.age, income: t.monthlyIncome, expense: t.monthlyExpense }))}
            lines={[{ key: "expense", cls: "en-fi" }, { key: "income", cls: "en-inc" }]}
          />
          <div className="en-legend"><span className="l-inc">הכנסה חודשית</span><span className="l-fi">הוצאה חודשית</span></div>
        </div>

        <div className="fcard">
          <h2>תרחישים והנחות</h2>
          <div className="en-chips">
            {Object.entries(SCENARIOS).map(([k, s]) => (
              <span key={k} className="en-chip">
                <button type="button" onClick={() => pick(k)}>{s.label}</button>
                <Info text={HELP[("s_" + k) as keyof typeof HELP]} />
              </span>
            ))}
          </div>
          <div className="en-grid2">
            <Slider label="צמצום משרה / ירידה בהכנסה" help={HELP.incomeLoss} value={scenario.incomeLoss} min={0} max={35000} step={1000} fmt={ils} onChange={(v) => setScenario((s) => ({ ...s, incomeLoss: v }))} />
            <Slider label="התאמת הוצאה חודשית" help={HELP.expenseAdjust} value={scenario.expenseAdjust} min={-10000} max={20000} step={500} fmt={ils} onChange={(v) => setScenario((s) => ({ ...s, expenseAdjust: v }))} />
            <Slider label="תשואה שנתית נטו" help={HELP.roi} value={a.roi} min={1} max={15} step={0.5} fmt={(n) => n + "%"} onChange={(v) => set("roi", v)} />
            <Slider label="אינפלציה שנתית" help={HELP.inflation} value={a.inflation} min={0} max={6} step={0.5} fmt={(n) => n + "%"} onChange={(v) => set("inflation", v)} />
            <Slider label="גיל נוכחי" help={HELP.currentAge} value={a.currentAge} min={20} max={80} step={1} onChange={(v) => set("currentAge", v)} />
            <Slider label="גיל פרישה" help={HELP.retirementAge} value={a.retirementAge} min={40} max={90} step={1} onChange={(v) => set("retirementAge", v)} />
            <Slider label="גיל תחילת פנסיה" help={HELP.pensionAge} value={a.pensionAge} min={55} max={75} step={1} onChange={(v) => set("pensionAge", v)} />
            <Slider label="שיעור כיסוי פנסיוני מההכנסה" help={HELP.pensionRatio} value={a.pensionRatio} min={0} max={100} step={1} fmt={(n) => n + "%"} onChange={(v) => set("pensionRatio", v)} />
            <Slider label="זחילת רמת חיים מעל האינפלציה" help={HELP.creep} value={a.lifestyleCreep} min={0} max={5} step={0.5} fmt={(n) => n + "%"} onChange={(v) => set("lifestyleCreep", v)} />
            <Slider label="גידול ריאלי בשכר" help={HELP.incomeGrowth} value={a.incomeGrowth} min={0} max={5} step={0.5} fmt={(n) => n + "%"} onChange={(v) => set("incomeGrowth", v)} />
          </div>
          <label className="en-check"><input type="checkbox" checked={a.workAfterRetirement} onChange={(e) => set("workAfterRetirement", e.target.checked)} /><span>ההכנסה מעבודה נמשכת גם אחרי גיל הפרישה <Info text={HELP.workAfter} /></span></label>
          <label className="en-check"><input type="checkbox" checked={a.glidePath} onChange={(e) => set("glidePath", e.target.checked)} /><span>הפחתת סיכון הדרגתית: 8% ב-10 השנים הראשונות ואז 4% <Info text={HELP.glide} /></span></label>
          {a.roi >= 15 && <p className="en-warn">⚠ תשואה של {a.roi}% לאורך זמן נראית לא סבירה.</p>}
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

        <div className="en-save">
          <button type="button" disabled={!dirty || pending} onClick={save}>{pending ? "שומר..." : "שמירת ההנחות"}</button>
          <span className="muted small">{dirty ? "יש שינויים שלא נשמרו" : msg}</span>
          <span className="muted small">תרחישי הסליידרים העליונים לא נשמרים; שאר ההנחות נשמרות לשניכם.</span>
        </div>
      </div>
    </div>
  );
}
