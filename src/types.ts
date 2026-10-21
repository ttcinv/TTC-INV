export interface Item {
  no: number;
  code: string;
  sys: string;
  desc: string;
  cat: string;
  srp: number;
  loc: string;
  vat: 'VAT' | 'NVAT';
  deliv: number;
  wd: number;
  conv: number;
  cv: number;
}

export interface Row {
  no: number | '';
  date: string; // YYYY-MM-DD
  loc: string;
  fr: 'AM' | 'PM';
  beg: number | '';
  del: number | '';
  doc?: string;
  wd: number | '';
  tf: number | '';
  tfl?: string;
  itf: number | '';
  tt: number | '';
  ttl?: string;
  itt: number | '';
  bad: number | '';
  end: number | '';
  gen?: boolean;
}

export interface User {
  id: number;
  name: string;
  all: boolean;
  locs: string[];
  acc: string[];
  res: string[];
  user: string;
  salt: string;
  hash: string;
}

export interface CashierInfo {
  cashier: string;
  shift: string;
}

export interface LogEntry {
  id?: string;
  t: string; // ISO string
  u: string;
  tab: string;
  act: string;
  desc: string;
  date?: string;
  loc?: string;
}

export interface AppState {
  v: number;
  locs: string[];
  inv: string;
  start: string;
  cut: string;
  items: Item[];
  rows: Row[];
  cash: Record<string, number | ''>;
  cinfo: Record<string, CashierInfo>;
  cashiers: string[];
  cpay: Record<string, number>;
  users: User[];
  log: LogEntry[];
  vd?: string;
  vf?: 'AM' | 'PM';
  nc?: Record<string, number>;
}

export interface RowComputed {
  auto: boolean;
  beg: number;
  tg: number;
  sold: number;
  srp: number;
  sales: number;
}
