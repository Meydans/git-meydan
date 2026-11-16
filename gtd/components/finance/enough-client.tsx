"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
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

const SCENARIOS: Record<string, { label: string; roi?: number; inflation?: number } & Scenario> = {
  now: { label: "מצב נוכחי", incomeLoss: 0, expenseAdjust: 0 },
  good: { label: "אופטימי", incomeLoss: 0, expenseAdjust: -2000, roi: 9, inflation: 1.5 },
  safe: { label: "שמרני", incomeLoss: 0, expenseAdjust: 2500, roi: 4, inflation: 3 },
  crisis: { label: "משבר", incomeLoss: 15000, expenseAdjust: 6000, roi: 2, inflation: 4 },
};

function Slider(props: { label: string; value: number; min: number; max: number; step: number; fmt?: (n: number) => string; onChange: (n: number) => void }) {
  return (
    <label className="en-ctl">
      <span className="en-ctl-top">
        <span>{props.label}</span>
        <b className="num">{props.fmt ? props.fmt(props.value) : props.value}</b>
      </span>
      <input type="range" min={props.min} max={props.max} step={props.step} value={props.value} onChange={(e) => props.onChange(Number(e.target.value))} />
    </label>
  );
}

function Chart({ points, target }: { points: { age: number; balance: number; fi: number }[]; target: number | null }) {
  const W = 760;
  const H = 280;
  const pad = { l: 56, r: 12, t: 12, b: 26 };
  const ys = points.flatMap((p) => [p.balance, p.fi]);
  const max = Math.max(...ys, 1);
  const min = Math.min(...ys, 0);
  const x = (age: number) => pad.l + ((age - points[0].age) / Math.max(1, points[points.length - 1].age - points[0].age)) * (W - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - (v - min) / Math.max(1, max - min)) * (H - pad.t - pad.b);
  const line = (key: "balance" | "fi") => points.map((p, i) => `${i ? "L" : "M"}${x(p.age).toFixed(1)},${y(p[key]).toFixed(1)}`).join("");
  const ticks = [min, min + (max - min) / 2, max];
  const ages = points.filter((p) => p.age % 10 === 0);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="en-chart" role="img" aria-label="תחזית ההון הנזיל לפי גיל">
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
      <path d={line("fi")} className="en-fi" fill="none" />
      <path d={line("balance")} className="en-bal" fill="none" />
      {target != null && <line x1={x(target)} x2={x(target)} y1={pad.t} y2={H - pad.b} className="en-mark" />}
    </svg>
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
            <div><span>הון נזיל</span><b className="num">{short(base.liquid)}</b></div>
            <div><span>הכנסה חודשית</span><b className="num">{ils(r.monthlyIncome)}</b></div>
            <div><span>הוצאה חודשית</span><b className="num">{ils(r.monthlyExpense)}</b></div>
            <div><span>עודף חודשי</span><b className={"num " + (r.surplus < 0 ? "bad" : "good")}>{ils(r.surplus)}</b></div>
          </div>
          <label className="en-check">
            <input type="checkbox" checked={a.deductEmergency} onChange={(e) => set("deductEmergency", e.target.checked)} />
            <span>לנכות את קרן החירום ({short(inv.emergency)}) מההון המושקע</span>
          </label>
        </div>

        <div className="fcard">
          <h2>התוצאה</h2>
          <div className="en-kpis">
            <div><span>הון בפרישה (גיל {a.retirementAge})</span><b className="num">{r.atRetirement == null ? "—" : short(r.atRetirement)}</b></div>
            <div><span>יעד חופש כלכלי בפרישה</span><b className="num">{r.fiTargetAtRetirement == null ? "—" : short(r.fiTargetAtRetirement)}</b></div>
            <div><span>הגעה לחופש כלכלי</span><b className={"num " + (r.fiAge ? "good" : "bad")}>{r.fiAge ? `גיל ${r.fiAge} (בעוד ${r.fiYears})` : "לא הושג"}</b></div>
            <div><span>נקודת השפל</span><b className={"num " + (r.lowest < 0 ? "bad" : "")}>{short(r.lowest)} (גיל {r.lowestAge})</b></div>
          </div>
          <p className={"en-verdict " + (ok ? "good" : "bad")}>
            {ok ? `✓ ההון מחזיק עד גיל ${END_AGE} אם פורשים בגיל ${a.retirementAge}.` : `✕ ההון אוזל לפני גיל ${END_AGE} אם פורשים בגיל ${a.retirementAge}.`}
          </p>
          <Chart points={r.timeline.map((t) => ({ age: t.age, balance: t.balance, fi: t.fiTarget }))} target={r.fiAge} />
          <div className="en-legend"><span className="l-bal">הון נזיל</span><span className="l-fi">יעד חופש כלכלי</span><span className="l-mark">נקודת ההגעה</span></div>
        </div>

        <div className="fcard">
          <h2>תרחישים והנחות</h2>
          <div className="en-chips">
            {Object.entries(SCENARIOS).map(([k, s]) => (
              <button key={k} type="button" onClick={() => pick(k)}>{s.label}</button>
            ))}
          </div>
          <div className="en-grid2">
            <Slider label="צמצום משרה / ירידה בהכנסה" value={scenario.incomeLoss} min={0} max={35000} step={1000} fmt={ils} onChange={(v) => setScenario((s) => ({ ...s, incomeLoss: v }))} />
            <Slider label="התאמת הוצאה חודשית" value={scenario.expenseAdjust} min={-10000} max={20000} step={500} fmt={ils} onChange={(v) => setScenario((s) => ({ ...s, expenseAdjust: v }))} />
            <Slider label="תשואה שנתית נטו" value={a.roi} min={1} max={15} step={0.5} fmt={(n) => n + "%"} onChange={(v) => set("roi", v)} />
            <Slider label="אינפלציה שנתית" value={a.inflation} min={0} max={6} step={0.5} fmt={(n) => n + "%"} onChange={(v) => set("inflation", v)} />
            <Slider label="גיל נוכחי" value={a.currentAge} min={20} max={80} step={1} onChange={(v) => set("currentAge", v)} />
            <Slider label="גיל פרישה" value={a.retirementAge} min={40} max={90} step={1} onChange={(v) => set("retirementAge", v)} />
            <Slider label="גיל תחילת פנסיה" value={a.pensionAge} min={55} max={75} step={1} onChange={(v) => set("pensionAge", v)} />
            <Slider label="שיעור כיסוי פנסיוני מההכנסה" value={a.pensionRatio} min={0} max={100} step={1} fmt={(n) => n + "%"} onChange={(v) => set("pensionRatio", v)} />
            <Slider label="זחילת רמת חיים מעל האינפלציה" value={a.lifestyleCreep} min={0} max={5} step={0.5} fmt={(n) => n + "%"} onChange={(v) => set("lifestyleCreep", v)} />
            <Slider label="גידול ריאלי בשכר" value={a.incomeGrowth} min={0} max={5} step={0.5} fmt={(n) => n + "%"} onChange={(v) => set("incomeGrowth", v)} />
          </div>
          <label className="en-check"><input type="checkbox" checked={a.workAfterRetirement} onChange={(e) => set("workAfterRetirement", e.target.checked)} /><span>ההכנסה מעבודה נמשכת גם אחרי גיל הפרישה</span></label>
          <label className="en-check"><input type="checkbox" checked={a.glidePath} onChange={(e) => set("glidePath", e.target.checked)} /><span>הפחתת סיכון הדרגתית: 8% ב-10 השנים הראשונות ואז 4%</span></label>
          {a.roi >= 15 && <p className="en-warn">⚠ תשואה של {a.roi}% לאורך זמן נראית לא סבירה.</p>}
        </div>

        <div className="fcard">
          <h2>ילדים ואירועי הון</h2>
          <div className="en-row">
            <label>גילאי הילדים (מופרדים בפסיק)
              <input
                key={a.childrenAges.length}
                defaultValue={a.childrenAges.join(", ")}
                placeholder="למשל 6, 9"
                onBlur={(e) => set("childrenAges", e.target.value.split(/[,\s]+/).map(Number).filter((n) => Number.isFinite(n) && n >= 0 && n <= 60 && e.target.value.trim() !== "").slice(0, 10))}
              />
            </label>
            <label>חלק הילדים בהוצאה החודשית (₪)
              <input type="number" min={0} step={100} value={a.kidsMonthly} onChange={(e) => set("kidsMonthly", Math.max(0, Number(e.target.value) || 0))} />
            </label>
          </div>
          <p className="muted small">התקציב מתחלק שווה בין הילדים; חלקו של כל ילד יורד בחצי בגיל 18 ונעלם בגיל 21.</p>
          <table className="en-events">
            <thead><tr><th>אירוע</th><th>גיל</th><th>סכום (₪, שלילי להוצאה)</th><th /></tr></thead>
            <tbody>
              {a.events.map((e, i) => (
                <tr key={i}>
                  <td><input value={e.desc} placeholder="למשל שיפוץ" onChange={(ev) => setEvent(i, { desc: ev.target.value })} /></td>
                  <td><input type="number" value={e.age} onChange={(ev) => setEvent(i, { age: Number(ev.target.value) || 0 })} /></td>
                  <td><input type="number" step={1000} value={e.amount} onChange={(ev) => setEvent(i, { amount: Number(ev.target.value) || 0 })} /></td>
                  <td><button type="button" aria-label="מחיקה" onClick={() => set("events", a.events.filter((_, j) => j !== i))}>×</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <button type="button" className="en-add" onClick={() => set("events", [...a.events, { desc: "", age: Math.min(90, a.currentAge + 5), amount: 0 }])}>+ הוסף אירוע</button>
        </div>

        <div className="fcard">
          <h2>הנדסה לאחור: איך מקדימים את הפרישה?</h2>
          <Slider label="גיל יעד לפרישה" value={goalAge} min={Math.max(a.currentAge, 40)} max={75} step={1} onChange={setGoalAge} />
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
