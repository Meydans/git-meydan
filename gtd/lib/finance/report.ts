// "Export for analysis": a self-contained Markdown picture of the plan, written so that a person or
// an AI tool can understand and check it without the code: starting point, every assumption with
// its unit, the model's rules, the results and the year-by-year projection. Pure, no I/O.
import { childWeight, earliestRetirement, END_AGE, goalSeek, monthlyPension, PENSION_FACTOR, simulate, type Assumptions, type Base, type Scenario } from "./simulator.ts";

export type ReportInput = {
  base: Base; // after the emergency-fund choice
  liquidTotal: number; // liquid before that choice
  emergency: number;
  pensionSavings?: { who: string; balance: number }[];
  incomeMissing: boolean;
  expenseMissing: boolean;
  assumptions: Assumptions;
  scenario: Scenario;
  goalAge: number;
  now?: Date;
};

const ils = (n: number) => (n < 0 ? "-" : "") + "₪" + Math.round(Math.abs(n)).toLocaleString("en-US");
const pct = (n: number) => `${n}%`;
const yesNo = (b: boolean) => (b ? "כן" : "לא");
const cell = (s: string) => s.replace(/\|/g, "/").replace(/\n/g, " ");

function table(head: string[], rows: string[][]): string {
  return [`| ${head.join(" | ")} |`, `| ${head.map(() => "---").join(" | ")} |`, ...rows.map((r) => `| ${r.map(cell).join(" | ")} |`)].join("\n");
}

export function analysisReport(input: ReportInput): string {
  const { base, assumptions: a, scenario: s } = input;
  const now = input.now ?? new Date();
  const year = now.getFullYear();
  const r = simulate(base, a, s);
  const g = goalSeek(base, a, s, input.goalAge);
  const earliest = earliestRetirement(base, a, s);
  const date = `${year}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const out: string[] = [];

  out.push(`# כמה זה מספיק: תמונת מצב לניתוח (${date})`);
  out.push(
    [
      "## איך לקרוא את הקובץ",
      "- זה פלט של סימולטור פרישה וחופש כלכלי של משק בית בישראל. הוא מתאר את הנתונים, ההנחות, כללי החישוב והתוצאות, כך שאפשר לבדוק ולנתח אותו בלי הקוד.",
      "- כל הסכומים בשקלים (₪). \"חודשי\" = לחודש; \"שנתי\" = לשנה.",
      "- \"בכסף של היום\" = במחירי היום; המודל מצמיד אותו לאינפלציה לשנה שבה הוא חל.",
      "- בטבלת התחזית השנתית כל הסכומים נומינליים, בכסף של אותה שנה (כולל אינפלציה).",
      "- \"הון נזיל\" = כסף שאפשר למשוך בלי קנס (עו\"ש, קרנות כספיות, תיקי השקעות וכו'). לא כולל פנסיה, נדל\"ן וכספים נעולים.",
      `- התחזית שנתית, מהגיל הנוכחי (${a.currentAge}, שנת ${year}) עד גיל ${END_AGE}.`,
    ].join("\n"),
  );

  const warn: string[] = [];
  if (input.incomeMissing) warn.push("- ⚠ ההכנסה החודשית לא הוגדרה במלאי, והחישוב מניח 0.");
  if (input.expenseMissing) warn.push("- ⚠ ההוצאה החודשית לא הוגדרה במלאי, והחישוב מניח 0.");

  out.push(
    [
      "## נקודת פתיחה (מהמלאי, נכון לתאריך ההפקה)",
      ...warn,
      table(
        ["פריט", "ערך", "הערה"],
        [
          ["הון נזיל כולל", ils(input.liquidTotal), "שורות מלאי בנזילות \"מיידי\" או \"נזיל בעלות\""],
          ["קרן חירום", ils(input.emergency), "חלק מההון הנזיל שמיועד לחירום"],
          ["ניכוי קרן החירום מההון המושקע", yesNo(a.deductEmergency), a.deductEmergency ? "קרן החירום לא משתתפת בתחזית" : "קרן החירום כלולה בהון שמושקע"],
          ["הון התחלתי בתחזית", ils(base.liquid), ""],
          ["הכנסה חודשית נטו (בסיס)", ils(base.income), "של משק הבית, היום"],
          ["הוצאה חודשית (בסיס)", ils(base.expense), "של משק הבית, היום, כולל הילדים"],
          ["תרחיש: שינוי בהכנסה", ils(s.incomeChange), "תרחיש \"מה אם\", מתווסף להכנסה של היום"],
          ["תרחיש: התאמת הוצאה", ils(s.expenseAdjust), "תרחיש \"מה אם\", מתווסף להוצאה של היום"],
          ["הכנסה חודשית בתחזית", ils(r.monthlyIncome), "בסיס + תרחיש"],
          ["הוצאה חודשית בתחזית", ils(r.monthlyExpense), "בסיס + תרחיש"],
          ["עודף חודשי", ils(r.surplus), "הכנסה פחות הוצאה"],
        ],
      ),
    ].join("\n\n"),
  );

  out.push(
    [
      "## הנחות",
      table(
        ["הנחה", "ערך", "משמעות"],
        [
          ["גיל נוכחי", String(a.currentAge), a.birthYear ? `מחושב משנת לידה ${a.birthYear}` : "הוזן ידנית"],
          ["גיל פרישה", String(a.retirementAge), "ממנו ההכנסה מעבודה נפסקת"],
          ["הכנסה מעבודה נמשכת אחרי הפרישה", yesNo(a.workAfterRetirement), ""],
          ["גיל תחילת פנסיה", String(a.pensionAge), ""],
          ...(a.pensions
            ? [
                ...a.pensions.map((p) => [`קצבה חודשית צפויה${p.who ? ` (${p.who})` : ""}`, ils(p.monthly), "מהדוח השנתי של הקרן, בכסף של היום, כולל ההפקדות עד הפרישה"]),
                ["סך הקצבה החודשית", ils(monthlyPension(a, 0)), "צמודה לאינפלציה, מגיל תחילת הפנסיה"],
              ]
            : [["קצבה חודשית (הערכה)", ils(r.monthlyIncome * (a.pensionRatio / 100)), `לא הוזנה קצבה מהדוח השנתי, ולכן מניחים ${pct(a.pensionRatio)} מההכנסה החודשית של היום`]]),
          ...(input.pensionSavings ?? []).map((p) => [
            `צבירה בקרן פנסיה${p.who ? ` (${p.who})` : ""}`,
            ils(p.balance),
            `לא בהון הנזיל. לבדה, בלי הפקדות ותשואה עתידיות, שווה כ-${ils(p.balance / PENSION_FACTOR)} לחודש (חלקי ${PENSION_FACTOR})`,
          ]),
          ["תשואה שנתית נטו", a.glidePath ? "לא בשימוש (מודל דינמי)" : pct(a.roi), "על ההון הנזיל, אחרי דמי ניהול ומס"],
          ["הפחתת סיכון הדרגתית", yesNo(a.glidePath), "אם כן: 8% ב-10 השנים הראשונות, ואז 4%"],
          ["אינפלציה שנתית", pct(a.inflation), "מצמידה הכנסה, הוצאה, אירועים ושינויים בהכנסה"],
          ["זחילת רמת חיים", pct(a.lifestyleCreep), "עלייה שנתית בהוצאה מעבר לאינפלציה"],
          ["גידול ריאלי בשכר", pct(a.incomeGrowth), "עלייה שנתית בהכנסה מעבודה מעבר לאינפלציה"],
          ["כלל חופש כלכלי", `${a.rule} × הוצאה חודשית`, `${a.rule} חודשי מחיה ≈ משיכה של ${(1200 / a.rule).toFixed(1)}% בשנה`],
        ],
      ),
    ].join("\n\n"),
  );

  const kids = a.childrenAges.length
    ? table(
        ["ילד", "גיל היום", "משקל היום"],
        a.childrenAges.map((age, i) => [String(i + 1), String(age), String(childWeight(age))]),
      )
    : "לא הוזנו גילאי ילדים, ולכן תקציב הילדים לא משתנה עם הזמן.";
  out.push(
    [
      "## ילדים",
      `- חלק הילדים מההוצאה החודשית היום: ${ils(a.kidsMonthly)} (כלול בהוצאה החודשית).`,
      `- תמיכה חודשית בכל ילד מגיל 21 עד גיל ${a.adultSupportUntil}: ${ils(a.adultSupport)} בכסף של היום.`,
      kids,
    ].join("\n\n"),
  );

  out.push(
    [
      "## אירועי הון (חד-פעמיים)",
      a.events.length
        ? table(
            ["תיאור", "גיל", "שנה", "סכום בכסף של היום", "סכום בשנת האירוע"],
            a.events.map((e) => {
              const y = e.age - a.currentAge;
              return [e.desc || "—", String(e.age), String(year + y), ils(e.amount), y >= 0 && e.age <= END_AGE ? ils(e.amount * Math.pow(1 + a.inflation / 100, y)) : "מחוץ לתחזית"];
            }),
          )
        : "אין.",
    ].join("\n\n"),
  );

  out.push(
    [
      "## שינויים עתידיים בהכנסה (חודשיים)",
      a.incomeChanges.length
        ? table(
            ["תיאור", "סכום חודשי בכסף של היום", "מגיל", "עד גיל (לא כולל)"],
            a.incomeChanges.map((c) => [c.desc || "—", ils(c.monthly), String(c.fromAge), c.toAge == null ? `הפרישה (${a.workAfterRetirement ? END_AGE + 1 : a.retirementAge})` : String(c.toAge)]),
          )
        : "אין.",
    ].join("\n\n"),
  );

  out.push(
    [
      "## כללי המודל",
      "1. בכל שנה, מהגיל הנוכחי עד 90, לפי הסדר:",
      "   1. בודקים אם ההון בתחילת השנה ≥ יעד החופש הכלכלי של אותה שנה (לא בשנה הראשונה). הפעם הראשונה = גיל ההגעה לחופש כלכלי.",
      "   2. ההון גדל בתשואה של השנה, רק אם הוא חיובי. חוסר (הון שלילי) לא צובר תשואה ולא ריבית.",
      "   3. מוסיפים הכנסה שנתית ומפחיתים הוצאה שנתית (12 × החודשי).",
      "   4. מוסיפים אירועי הון של אותו גיל, מוצמדים לאינפלציה מהיום.",
      "2. הכנסה מעבודה: ההכנסה של היום × (1 + אינפלציה + גידול ריאלי)^שנים, עד גיל הפרישה. אחר כך 0, אלא אם העבודה נמשכת.",
      "3. שינויים עתידיים בהכנסה: מתווספים בטווח הגילים שלהם, מוצמדים כמו השכר. לא משפיעים על הפנסיה.",
      a.pensions
        ? "4. פנסיה: מגיל תחילת הפנסיה, סכום הקצבאות הצפויות מהדוחות השנתיים (בכסף של היום), צמוד לאינפלציה מהיום. כספי הפנסיה עצמם לא בהון הנזיל, הם משפיעים רק דרך הקצבה."
        : "4. פנסיה: לא הוזנה קצבה צפויה, ולכן מגיל תחילת הפנסיה: אחוז מההכנסה של היום, צמוד לאינפלציה מהיום. כספי הפנסיה עצמם לא בהון הנזיל.",
      "5. הוצאה: (הוצאה בלי ילדים + תקציב ילדים × מקדם גיל + תמיכה בבוגרים) × (1 + אינפלציה + זחילה)^שנים.",
      "6. מקדם גיל הילדים: סכום משקלי הילדים בשנה הזו חלקי הסכום היום. משקל לפי גיל: עד 10 = 1; 10 עד 18 = 1.8; 18 עד 21 (צבא) = 0.6; מ-21 = 0.",
      "   - מקור 1 ו-1.8: Karlinsky & Sarel, Estimating the Cost of Raising Children in Israel, Bank of Israel, Israel Economic Review 18(1), 2020 (נתוני סקר ההוצאות של הלמ\"ס): ילד בן 10 ומעלה עולה כ-1.8 מילד צעיר בכל רמת הכנסה.",
      "   - מקור 0.6: סקר מרכז המחקר והמידע של הכנסת על חיילים בשירות סדיר (2018), ונוהג בתי המשפט להפחית מזונות לכשליש בזמן השירות.",
      `7. יעד חופש כלכלי בכל שנה = (הוצאה חודשית − הפנסיה החודשית של אותה שנה, לא פחות מ-0) × ${a.rule}, ולפני גיל הפנסיה נוסף "גשר" = החלק שהפנסיה תכסה × 12 × מספר השנים עד תחילתה.`,
      `8. "ההון מחזיק" = ההון לא יורד מתחת ל-0 באף שנה עד גיל ${END_AGE}. "גיל הדלדול" = השנה הראשונה שבה הוא יורד מתחת ל-0.`,
      `   - יעד ה-${a.rule} מכוון להון שמחזיק לתמיד, ולכן הוא מבחן מחמיר יותר מ"ההון מחזיק עד ${END_AGE}". אפשר לא להגיע לחופש כלכלי ועדיין שההון יחזיק עד ${END_AGE}.`,
      `9. "פרישה מוקדמת שמחזיקה" = גיל הפרישה הנמוך ביותר שבו ההון מחזיק, כשכל שאר ההנחות קבועות.`,
      `10. הנדסה לאחור: פורשים בגיל היעד וההון צריך להחזיק עד ${END_AGE}. מחפשים (בחיפוש בינארי על המודל המלא) את החיסכון החודשי הנוסף מהיום עד הפרישה, בכסף של היום ומוצמד כמו השכר, או את התשואה השנתית הקבועה, שמספיקים לכך.`,
    ].join("\n"),
  );

  out.push(
    [
      "## תוצאות",
      table(
        ["מדד", "ערך"],
        [
          [`הון נזיל בגיל הפרישה (${a.retirementAge})`, r.atRetirement == null ? "—" : ils(r.atRetirement)],
          ["יעד חופש כלכלי בגיל הפרישה", r.fiTargetAtRetirement == null ? "—" : ils(r.fiTargetAtRetirement)],
          ["גיל הגעה לחופש כלכלי", r.fiAge ? `${r.fiAge} (בעוד ${r.fiYears} שנים)` : "לא מגיעים עד גיל 90"],
          ["נקודת השפל של ההון", r.depletionAge == null ? `${ils(r.lowest)} בגיל ${r.lowestAge}` : "לא רלוונטי: ההון נגמר (ראו גיל הדלדול)"],
          [`ההון מחזיק עד גיל ${END_AGE}`, yesNo(r.survives)],
          [`גיל דלדול ההון (פרישה ב-${a.retirementAge})`, r.depletionAge == null ? "ההון לא נגמר" : String(r.depletionAge)],
          ["גיל הפרישה המוקדם ביותר שמחזיק עד 90", earliest == null ? "אין" : String(earliest)],
          [
            `הנדסה לאחור: חיסכון חודשי נוסף לפרישה בגיל ${input.goalAge}`,
            g.years <= 0 ? "—" : g.alreadyOk ? "לא נדרש (כבר מחזיק)" : g.extraSaving == null ? "לא מספיק גם 200,000 ₪ בחודש" : `${ils(g.extraSaving)} בחודש בכסף של היום${g.extraSaving > g.income ? " (יותר מכל ההכנסה)" : ""}`,
          ],
          [
            `הנדסה לאחור: תשואה שנתית נדרשת לפרישה בגיל ${input.goalAge}`,
            g.years <= 0 ? "—" : g.alreadyOk ? "לא נדרש שינוי" : g.roi == null ? "לא מספיקה גם 30%" : `${g.roi.toFixed(1)}%`,
          ],
        ],
      ),
    ].join("\n\n"),
  );

  out.push(
    [
      "## תחזית שנתית (כסף של אותה שנה)",
      table(
        ["גיל", "שנה", "הון נזיל בסוף השנה", "הכנסה חודשית ממוצעת", "הוצאה חודשית", "יעד חופש כלכלי", "אירועים"],
        r.timeline.map((t) => [
          String(t.age),
          String(year + t.age - a.currentAge),
          ils(t.balance),
          ils(t.monthlyIncome),
          ils(t.monthlyExpense),
          ils(t.fiTarget),
          t.events.map((e) => `${e.desc || "אירוע"} ${ils(e.amount)} (היום)`).join("; "),
        ]),
      ),
    ].join("\n\n"),
  );

  out.push(
    [
      "## מגבלות ידועות",
      "- גיל אחד למשק הבית: הפרישה והפנסיה של שני בני הזוג מחושבות לפי אותו גיל.",
      a.pensions
        ? "- הקצבה הצפויה בדוח השנתי מניחה המשך הפקדות ותשואה של הקרן; אם השכר או ההפקדות משתנים, הקצבה בפועל תשתנה."
        : "- לא הוזנה קצבה צפויה: הפנסיה היא אחוז מההכנסה של היום ולא מבוססת על הצבירה או על הדוח השנתי.",
      "- תשואה קבועה בכל שנה, בלי תנודתיות ובלי סיכון רצף תשואות.",
      "- מס: התשואה מוזנת נטו; אין חישוב מס נפרד על משיכות או על רווחי הון.",
      "- נדל\"ן, משכנתה והלוואות לא נכנסים לתחזית; רק ההון הנזיל.",
      "- הכנסה מהשכרה או ממקורות אחרים נכללת רק אם היא חלק מההכנסה החודשית או משינוי עתידי בהכנסה.",
    ].join("\n"),
  );

  return out.join("\n\n") + "\n";
}
