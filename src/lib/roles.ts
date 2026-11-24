export type Role = 'admin' | 'manager' | 'cashier' | 'storekeeper' | 'accountant';

export const ROLES: Role[] = ['admin', 'manager', 'cashier', 'storekeeper', 'accountant'];

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Super Admin',
  manager: 'Branch Manager',
  cashier: 'Cashier',
  storekeeper: 'Storekeeper',
  accountant: 'Accountant',
};

export type Tab = 'dashboard' | 'pos' | 'inventory' | 'debtors' | 'reports' | 'staff' | 'settings';

// Which roles may open each page. The database enforces the same rules
// (row-level security + server functions); this only decides what the UI shows.
export const TAB_ACCESS: Record<Tab, Role[]> = {
  dashboard: ['admin', 'manager', 'cashier', 'storekeeper', 'accountant'],
  pos: ['admin', 'manager', 'cashier'],
  inventory: ['admin', 'manager', 'storekeeper', 'accountant'],
  debtors: ['admin', 'manager', 'accountant'],
  reports: ['admin', 'manager', 'accountant'],
  staff: ['admin', 'manager'],
  settings: ['admin', 'manager', 'cashier', 'storekeeper', 'accountant'],
};

export const canAccessTab = (role: Role, tab: Tab) => TAB_ACCESS[tab].includes(role);

export const PERMISSIONS = {
  editInventory: ['admin', 'manager', 'storekeeper'] as Role[],
  deleteProduct: ['admin', 'manager'] as Role[],
  manageDebtors: ['admin', 'manager', 'accountant'] as Role[],
  editExchangeRates: ['admin'] as Role[],
  manageStaff: ['admin'] as Role[],
  switchBranch: ['admin'] as Role[],
};

export const can = (role: Role, permission: keyof typeof PERMISSIONS) =>
  PERMISSIONS[permission].includes(role);

// Highest discount (%) a role may give at the till. Enforced again by the database.
export const maxDiscount = (role: Role) => (role === 'cashier' ? 10 : 100);
