// 預覽版假資料（全部虛構，日期以今天為基準）
import { ymd, addD, stamp } from '../lib/util';

const today = new Date(); today.setHours(0, 0, 0, 0);
const d = (n) => ymd(addD(today, n));
const t = (n, h = 9) => { const x = addD(today, n); x.setHours(h, 30); return stamp(x); };
const iso = (n) => addD(today, n).toISOString();

export function demoSeed() {
  const customers = [
    { id: 'c1', name: '客戶 A', sort: 0, internal: false },
    { id: 'c2', name: '客戶 B', sort: 1, internal: false },
    { id: 'c_internal', name: '內部', sort: 2, internal: true },
  ];
  const profiles = [
    { id: 'u_hank', email: 'hank@company.com', name: 'Hank', role: 'admin', status: 'active', is_owner: true, tabs: null, created_at: iso(-60) },
    { id: 'u_amy', email: 'amy@company.com', name: 'Amy', role: 'engineer', status: 'active', is_owner: false, tabs: ['c_internal'], created_at: iso(-40) },
    { id: 'u_skye', email: 'skye@company.com', name: 'Skye', role: 'planner', status: 'active', is_owner: false, tabs: null, created_at: iso(-35) },
    { id: 'u_ken', email: 'ken@company.com', name: 'Ken', role: 'engineer', status: 'active', is_owner: false, tabs: ['c1', 'c2'], created_at: iso(-30) },
    { id: 'u_john', email: 'john@customer-a.com', name: 'John（客戶 A）', role: 'customer', status: 'active', is_owner: false, tabs: ['c1'], created_at: iso(-10) },
    { id: 'u_mary', email: 'mary@customer-b.com', name: 'Mary（客戶 B）', role: 'customer', status: 'pending', is_owner: false, tabs: ['c2'], created_at: iso(-1) },
    { id: 'u_new', email: 'newbie@company.com', name: '新同事', role: 'viewer', status: 'pending', is_owner: false, tabs: null, created_at: iso(0) },
  ];
  const members = [
    { id: 'm1', name: 'Hank', sort: 0, team: 'engineer', profile_id: 'u_hank' },
    { id: 'm2', name: 'Amy', sort: 1, team: 'engineer', profile_id: 'u_amy' },
    { id: 'm3', name: 'Ken', sort: 2, team: 'engineer', profile_id: 'u_ken' },
    { id: 'm4', name: 'Skye', sort: 3, team: 'planner', profile_id: 'u_skye' },
    { id: 'm5', name: 'Leo', sort: 4, team: 'engineer', profile_id: null },
  ];
  const machines = ['J750-01', 'J750-02', 'UFLEX-01', 'UFLEX-02'].map((name, i) => ({ id: 'k' + i, name }));
  const it = (id, c, o, item, owner, cust, machine, status, due, prio, remark, days, by, upd) =>
    ({ id, customer_id: c, sort_order: o, item, owner, cust_owner: cust, machine, status, due, priority: prio, remark, days, updated: t(upd), updated_by: by });
  const eng_items = [
    it('r1', 'c1', 1, '新產品 A 程式轉移（J750 → UltraFLEX）', 'Hank', 'John', 'UFLEX-01', '進行中', d(6), '最優先', '客戶要求 11 月底前完成 correlation', 5, 'Hank', -1),
    it('r2', 'c1', 2, '產品 B 測試時間縮短', 'Ken', 'John', 'J750-01', '等客戶回覆', d(2), '優先', '等客戶確認新的 limit', 3, 'Ken', -2),
    it('r3', 'c1', 3, '產品 C 良率異常分析', 'Hank', 'Peter', 'J750-02', '待審核', d(-1), '優先', '報告已送出', 2, 'Hank', -3),
    it('r4', 'c1', 4, '新 load board 驗證', 'Ken', 'John', 'UFLEX-02', '未開始', d(14), '普通', '', 4, 'Ken', -5),
    it('r5', 'c2', 1, '客戶 B 新案評估', 'Ken', 'Lisa', 'J750-01', '進行中', d(9), '普通', '', 3, 'Ken', -1),
    it('r6', 'c_internal', 1, 'Handler 定期保養', 'Amy', '', 'J750-02', '進行中', d(3), '普通', '內部作業', 1, 'Amy', 0),
    it('r7', 'c_internal', 2, '測試程式版本控管整理', 'Amy', '', '', '未開始', d(20), '擱置', '', 5, 'Amy', -7),
  ];
  const eng_logs = [
    { id: 'l1', row_id: 'r1', log_date: d(-1), author: 'Hank', body: '完成 pattern 轉換，correlation 跑了 3 顆，2 顆 pass。（內部紀錄，客戶看不到）', created: t(-1, 17), updated: t(-1, 17) },
    { id: 'l2', row_id: 'r2', log_date: d(-2), author: 'Ken', body: '已寄信給客戶確認 limit 修改。', created: t(-2, 15), updated: t(-2, 15) },
  ];
  const eng_files = [{ id: 'f1', row_id: 'r1', name: 'correlation 報告', kind: 'link', url: '\\\\server\\share\\demo\\correlation.xlsx', created: t(-1, 18) }];
  const pl = (id, c, machine, grp, product, hw, a, b, remark) => ({ id, customer_id: c, machine, grp, product, hw, start_date: d(a), end_date: d(b), remark, updated: t(-2), updated_by: 'Skye' });
  const prod_plans = [
    pl('p1', 'c1', 'UFLEX-01', 'G1', '產品 A 量產', false, -3, 4, ''),
    pl('p2', 'c1', 'J750-01', 'G2', '產品 B 工程批', true, 1, 6, '需 HW 換 socket'),
    pl('p3', 'c2', 'J750-01', 'G9', '客戶 B 試產', false, 8, 12, ''),
    pl('p4', 'c_internal', 'J750-02', '', '保養停機', false, 2, 3, '內部'),
  ];
  const signup_allow = [
    { pattern: '@company.com', note: '公司信箱', created_at: iso(-50), created_by: 'Hank', customer_id: null },
    { pattern: '@customer-a.com', note: '客戶 A', created_at: iso(-20), created_by: 'Hank', customer_id: 'c1' },
  ];
  const _online = [{ id: 'u_amy', name: 'Amy', role: 'engineer', owner: false, page: 'list', at: new Date().toISOString() }];
  return { customers, profiles, members, machines, eng_items, eng_logs, eng_files, prod_plans, signup_allow, settings: [{ id: 'app', workdays: false }], _online };
}
