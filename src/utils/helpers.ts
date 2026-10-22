import { AppState, Item, Row, RowComputed, User } from '../types';

export const KEY = 'inv_ledger_v1';
export const V = 6;
export const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const MN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export const num = (v: any): number => {
  const n = parseFloat(String(v ?? ''));
  return isNaN(n) ? 0 : n;
};

export const f2 = (v: any): string => {
  return num(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export const acct = (v: any): string => {
  const n = num(v);
  if (n === 0) return '-';
  if (n < 0) return '-' + f2(-n);
  return f2(n);
};

export const acp = (v: any): string => {
  const n = Math.round(num(v) * 100) / 100;
  if (n === 0) return '-';
  if (n < 0) return `(${f2(-n)})`;
  return f2(n);
};

export const q = (v: any): string => {
  const n = num(v);
  return n === 0 ? '' : n.toLocaleString('en-US', { maximumFractionDigits: 2 });
};

export const raw = (v: any): string | number => {
  return num(v) === 0 ? '' : v;
};

export const fd = (d: string): string => {
  if (!d || d.length < 10) return '';
  const day = +d.slice(8);
  const mo = MON[+d.slice(5, 7) - 1];
  const yr = d.slice(2, 4);
  return `${day}-${mo}-${yr}`;
};

export const addDay = (d: string, n: number): string => {
  const t = new Date(d + 'T00:00:00Z');
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
};

export const today = (): string => new Date().toISOString().slice(0, 10);

export const dcmp = (a?: string, b?: string): number => {
  const x = a || '~';
  const y = b || '~';
  return x < y ? -1 : x > y ? 1 : 0;
};

export const fo = (r: Row): number => (r.fr === 'PM' ? 1 : 0);

export const rnd = (): string => {
  try {
    return [...crypto.getRandomValues(new Uint8Array(8))]
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  } catch {
    return Math.random().toString(36).slice(2);
  }
};

export async function sha256(text: string): Promise<string> {
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch {
    // Fallback if subtle crypto isn't available
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    return 'fallback_' + Math.abs(hash).toString(16);
  }
}

export const unitCost = (it: Item): number => {
  return num(it.cv) > 0 ? num(it.deliv) / num(it.cv) : 0;
};

export const createInitialItem = (
  no: number,
  code: string,
  sys: string,
  desc: string,
  cat: string,
  srp: number,
  deliv: number,
  conv: number,
  wd: number
): Item => ({
  no,
  code,
  sys,
  desc,
  cat,
  srp,
  loc: 'Pastry',
  vat: 'VAT',
  deliv,
  conv,
  wd,
  cv: 1
});

export const createInitialRow = (no: number | '', date: string, o?: Partial<Row>): Row => ({
  no,
  date,
  loc: 'Commissary Takehome',
  fr: 'AM',
  beg: '',
  del: '',
  doc: '',
  wd: '',
  tf: '',
  tfl: '',
  itf: '',
  tt: '',
  ttl: '',
  itt: '',
  bad: '',
  end: '',
  ...o
});

export const getSeedState = (): AppState => ({
  v: V,
  log: [],
  locs: ['YTMI Takehome', 'YTP Takehome', 'Logistics Takehome', 'Commissary Takehome'],
  inv: 'Commissary Takehome',
  start: '2026-10-05',
  cut: '2026-10-31',
  items: [
    createInitialItem(1, 'FGPS00005', 'Pastry Bread - Asado Roll', 'Asado Roll', 'Breads', 10, 5, 5, 3.5),
    createInitialItem(2, 'FGBC00054', 'Pastry Bread - Cheese Custard Cupcake', 'Cheese Custard Cupcake', 'Cakes', 15, 8, 8, 6),
    createInitialItem(3, 'FGPS00005', 'Pastry Bread - Asado Roll', 'Asado Roll', 'Breads', 20, 5, 5, 3.5),
    createInitialItem(4, 'FGBC00054', 'Pastry Bread - Cheese Custard Cupcake', 'Cheese Custard Cupcake', 'Cakes', 25, 8, 8, 6)
  ],
  rows: [
    createInitialRow(1, '2026-10-05', { beg: 25, del: 15, wd: 5, tf: 2, tfl: 'YTMI Takehome', tt: 2, ttl: 'Logistics Takehome', bad: 5, end: 38 }),
    createInitialRow(1, '2026-10-06', { end: 36 }),
    createInitialRow(1, '2026-10-07', { end: 30 }),
    createInitialRow(1, '2026-10-08', { itt: 30 }),
    createInitialRow(2, '2026-10-12', { beg: 10, del: 25, wd: 5, tf: 2, tfl: 'YTP Takehome', tt: 2, ttl: 'Commissary Takehome', bad: 8, end: 30 }),
    createInitialRow(2, '2026-10-13', { end: 27 }),
    createInitialRow(2, '2026-10-14', { end: 23 }),
    createInitialRow(2, '2026-10-15', { itt: 23 }),
    createInitialRow(3, '2026-10-16', { itf: 30, end: 30 }),
    createInitialRow(4, '2026-10-16', { itf: 23, end: 23 })
  ].map(r => ({ ...r, loc: 'Commissary Takehome' })),
  cash: {},
  cashiers: ['Lica Cudiamat', 'Marlyn Maruya', 'Godelyn Roncales'],
  cinfo: {},
  cpay: {},
  users: [
    {
      id: 1,
      name: 'Ervin Nalo',
      all: true,
      locs: [],
      acc: ['All'],
      res: [],
      user: 'enalo',
      salt: 'inv-enalo-7f3a91c2',
      hash: '859bf38bf87191f4341612af7bc3a7385a07e14005f7bbed9dfddefe524116cc'
    },
    {
      id: 2,
      name: 'Railyn Perin',
      all: false,
      locs: ['YTMI Takehome', 'YTP Takehome'],
      acc: ['All'],
      res: [],
      user: 'rperin',
      salt: 'inv-rperin-c91d40e8',
      hash: 'f6c732ca58c6bfff91f4f56609587599b85be02f11a8e481c1f078eb57eff6a0'
    },
    {
      id: 3,
      name: 'Jennalyn Martinez',
      all: true,
      locs: [],
      acc: ['View Only', 'Inventory Location', 'Start Date', 'Cut Off Date'],
      res: [],
      user: 'jmartinez',
      salt: 'inv-jmartinez-5be2a7d1',
      hash: 'b0c47e49a5b96df506d905eacba8ace97ea4c7bbe69e1f812d38ebf333f062e9'
    },
    {
      id: 4,
      name: '',
      all: false,
      locs: [],
      acc: [],
      res: [],
      user: '',
      salt: '',
      hash: ''
    }
  ]
});

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        const seed = getSeedState();
        // Upgrade check
        if (!parsed.items) parsed.items = seed.items;
        if (!parsed.rows) parsed.rows = seed.rows;
        if (!parsed.locs) parsed.locs = seed.locs;
        if (!parsed.users) parsed.users = seed.users;
        if (!parsed.cashiers) parsed.cashiers = seed.cashiers;
        if (!parsed.cash) parsed.cash = {};
        if (parsed.cash['Commissary Takehome|2026-10-05'] === 35) {
          delete parsed.cash['Commissary Takehome|2026-10-05'];
        }
        if (!parsed.cinfo) parsed.cinfo = {};
        if (!parsed.cpay) parsed.cpay = {};
        if (!parsed.log) parsed.log = [];
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed to parse state from localStorage', e);
  }
  const seed = getSeedState();
  saveState(seed);
  return seed;
}

export function saveState(state: AppState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('LocalStorage save failed', e);
  }
}

export const inPeriod = (d: string, start: string, cut: string): boolean => {
  return !!d && d >= start && d <= cut;
};

export const getWeekOf = (d: string, start: string, cut: string): string => {
  if (!d) return '';
  if (inPeriod(d, start, cut)) {
    const w = Math.floor(Math.round((Date.parse(d) - Date.parse(start)) / 864e5) / 7) + 1;
    return `Week ${w}`;
  }
  return 'Other period';
};

export const getWeeksCount = (start: string, cut: string): number => {
  const n = Math.floor((Date.parse(cut) - Date.parse(start)) / 864e5 / 7) + 1;
  return n > 0 ? n : 0;
};

export const cashKey = (loc: string, date: string, shift: 'AM' | 'PM'): string => {
  return `${loc}|${date}${shift === 'PM' ? '|PM' : ''}`;
};

export const parseCashKey = (key: string): { loc: string; date: string; shift: 'AM' | 'PM' } => {
  const isPM = key.endsWith('|PM');
  const clean = isPM ? key.slice(0, -3) : key;
  const lastPipe = clean.lastIndexOf('|');
  const loc = clean.slice(0, lastPipe);
  const date = clean.slice(lastPipe + 1);
  return { loc, date, shift: isPM ? 'PM' : 'AM' };
};

export function computeRows(rows: Row[], items: Item[]): RowComputed[] {
  const itemMap = new Map<number, Item>();
  items.forEach(it => itemMap.set(it.no, it));

  const sortedIndices = rows.map((_, i) => i).sort((a, b) => {
    const rA = rows[a];
    const rB = rows[b];
    return dcmp(rA.date, rB.date) || fo(rA) - fo(rB) || a - b;
  });

  const last: Record<string, number> = {};
  const out: RowComputed[] = new Array(rows.length);

  sortedIndices.forEach(i => {
    const r = rows[i];
    const key = `${r.loc}|${r.no}`;
    const auto = r.no !== '' && key in last;
    const beg = auto ? last[key] : num(r.beg);
    const tg = beg + num(r.del) + num(r.tf) + num(r.itf) - num(r.tt) - num(r.itt);
    const sold = tg - num(r.end);
    const itemObj = r.no !== '' ? itemMap.get(r.no as number) : undefined;
    const srp = num(itemObj?.srp);
    const sales = sold * srp;

    out[i] = {
      auto,
      beg,
      tg,
      sold,
      srp,
      sales
    };

    if (r.no !== '') {
      last[key] = num(r.end);
    }
  });

  return out;
}

export function autoCarryOver(
  state: AppState,
  targetDate: string,
  targetShift: 'AM' | 'PM'
): Row[] {
  if (!state.start || targetDate < state.start || targetDate > state.cut) {
    return state.rows;
  }

  const last: Record<number, number> = {};
  const priorRows = state.rows
    .filter(
      r =>
        r.loc === state.inv &&
        r.no !== '' &&
        r.date &&
        (r.date < targetDate || (targetShift === 'PM' && r.date === targetDate && r.fr === 'AM'))
    )
    .sort((a, b) => dcmp(a.date, b.date) || fo(a) - fo(b));

  priorRows.forEach(r => {
    last[r.no as number] = num(r.end);
  });

  const newRows = [...state.rows];
  let carriedCount = 0;

  Object.keys(last)
    .map(Number)
    .forEach(no => {
      const ncKey = `${state.inv}|${targetDate}${targetShift === 'PM' ? '|PM' : ''}|${no}`;
      const dismissed = state.nc && state.nc[ncKey];
      const alreadyListed = state.rows.some(
        r => r.loc === state.inv && r.date === targetDate && r.fr === targetShift && r.no === no
      );

      if (last[no] > 0 && !dismissed && !alreadyListed) {
        newRows.push(
          createInitialRow(no, targetDate, {
            loc: state.inv,
            fr: targetShift,
            gen: true
          })
        );
        carriedCount++;
      }
    });

  return newRows;
}
