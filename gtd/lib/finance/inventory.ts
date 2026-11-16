// The headline numbers of the inventory, in the same terms as the "where we stand" page
// (components/finance/engine.js, model()). Pure, so the simulator can start from the same figures.

type Row = { type: string; liq: string; liqDate: string; purpose: string; value: string; cur: string; name: string };

function num(v: string): number | null {
  const s = String(v ?? "").replace(/[₪$,\s]/g, "").replace(/[^\d.-]/g, "");
  if (s === "" || s === "-" || s === ".") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function date(v: string): Date | null {
  const s = String(v ?? "").trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  m = s.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{2,4})$/);
  if (m) return new Date(+m[3] < 100 ? 2000 + +m[3] : +m[3], +m[2] - 1, +m[1]);
  return null;
}

export type InventoryBase = {
  liquid: number;
  emergency: number;
  income: number | null;
  expense: number | null;
  hasRows: boolean;
};

export function inventoryBase(rows: Row[], now = new Date()): InventoryBase {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const param = (name: string) => {
    const r = rows.find((x) => x.type === "פרמטר" && x.name === name);
    return r ? num(r.value) : null;
  };
  const rate = param("שער דולר") ?? 3.7;
  const assets = rows.filter((r) => !["פרמטר", "תרחיש", "הלוואה"].includes(r.type));
  const ils = (r: Row) => {
    const raw = num(r.value);
    if (raw == null) return 0;
    return String(r.cur).toUpperCase() === "USD" ? raw * rate : raw;
  };
  const liqOf = (r: Row) => {
    const liq = r.liq || "לא נזיל";
    const d = date(r.liqDate);
    return liq === "נעול עד תאריך" && d && d <= today ? "נזיל בעלות" : liq;
  };
  const sum = (list: Row[]) => list.reduce((s, r) => s + ils(r), 0);
  return {
    liquid: sum(assets.filter((r) => ["מיידי", "נזיל בעלות"].includes(liqOf(r)))),
    emergency: sum(assets.filter((r) => r.purpose === "חירום")),
    income: param("הכנסה חודשית נטו"),
    expense: param("הוצאה חודשית"),
    hasRows: rows.length > 0,
  };
}
