export type PermissionKey =
  | 'deleteCustomers' | 'deleteAppointments' | 'deleteUsers'
  | 'recordPayments' | 'viewReports' | 'exportReports'
  | 'manageServices' | 'manageBranches' | 'manageStaffAbsence'
  | 'viewUsers' | 'createUsers' | 'editUsers' | 'dashboard'
  | 'systemBackup' | 'managePermissions' | 'branchSwitching'
  | 'manageCustomers' | 'manageAppointments'
  | 'createCustomers' | 'editCustomers'
  | 'createAppointments' | 'editAppointments'
  | 'updateAppointmentStatus'
  | 'makePhoneCalls' | 'viewCallLogs' | 'clearCallLogs'
  | 'sendBroadcasts' | 'sendWhatsApp' | 'sendSMS' | 'sendEmail';

export type RolePermissions = Record<PermissionKey, boolean>;
export type AllPermissions = Record<string, RolePermissions>;

export const ALL_PERMISSION_KEYS: PermissionKey[] = [
  'deleteCustomers', 'deleteAppointments', 'deleteUsers',
  'recordPayments', 'viewReports', 'exportReports',
  'manageServices', 'manageBranches', 'manageStaffAbsence',
  'viewUsers', 'createUsers', 'editUsers', 'dashboard',
  'systemBackup', 'managePermissions', 'branchSwitching',
  'manageCustomers', 'manageAppointments',
  'createCustomers', 'editCustomers',
  'createAppointments', 'editAppointments',
  'updateAppointmentStatus',
  'makePhoneCalls', 'viewCallLogs', 'clearCallLogs',
  'sendBroadcasts', 'sendWhatsApp', 'sendSMS', 'sendEmail',
];

export const DEFAULT_PERMISSIONS: Record<string, RolePermissions> = {
  ADMIN: {
    deleteCustomers: true, deleteAppointments: true, deleteUsers: true,
    recordPayments: true, viewReports: true, exportReports: true,
    manageServices: true, manageBranches: true, manageStaffAbsence: true,
    viewUsers: true, createUsers: true, editUsers: true, dashboard: true,
    systemBackup: true, managePermissions: true, branchSwitching: true,
    manageCustomers: true, manageAppointments: true,
    createCustomers: true, editCustomers: true,
    createAppointments: true, editAppointments: true,
    updateAppointmentStatus: true,
    makePhoneCalls: true, viewCallLogs: true, clearCallLogs: true,
    sendBroadcasts: true, sendWhatsApp: true, sendSMS: true, sendEmail: true,
  },
  MANAGER: {
    deleteCustomers: false, deleteAppointments: false, deleteUsers: false,
    recordPayments: true, viewReports: true, exportReports: true,
    manageServices: true, manageBranches: true, manageStaffAbsence: true,
    viewUsers: true, createUsers: true, editUsers: true, dashboard: true,
    systemBackup: false, managePermissions: true, branchSwitching: true,
    manageCustomers: true, manageAppointments: true,
    createCustomers: true, editCustomers: true,
    createAppointments: true, editAppointments: true,
    updateAppointmentStatus: true,
    makePhoneCalls: true, viewCallLogs: true, clearCallLogs: true,
    sendBroadcasts: true, sendWhatsApp: true, sendSMS: true, sendEmail: true,
  },
  STAFF: {
    deleteCustomers: false, deleteAppointments: false, deleteUsers: false,
    recordPayments: false, viewReports: false, exportReports: false,
    manageServices: false, manageBranches: false, manageStaffAbsence: false,
    viewUsers: false, createUsers: false, editUsers: false, dashboard: false,
    systemBackup: false, managePermissions: false, branchSwitching: false,
    manageCustomers: true, manageAppointments: true,
    createCustomers: true, editCustomers: true,
    createAppointments: true, editAppointments: true,
    updateAppointmentStatus: true,
    makePhoneCalls: false, viewCallLogs: false, clearCallLogs: false,
    sendBroadcasts: false, sendWhatsApp: false, sendSMS: false, sendEmail: false,
  },
};

export const SYSTEM_ROLES = ['ADMIN', 'MANAGER', 'STAFF'] as const;

export const SYSTEM_ROLE_META: Record<string, {
  label: string; labelAr: string; color: string; icon: string;
  isAdmin: boolean; sortOrder: number;
}> = {
  ADMIN:   { label: 'Admin',   labelAr: 'مدير النظام', color: '#C4788C', icon: '👑',    isAdmin: true,  sortOrder: 0 },
  MANAGER: { label: 'Manager', labelAr: 'مدير',        color: '#0891b2', icon: '🧑‍💼', isAdmin: false, sortOrder: 1 },
  STAFF:   { label: 'Staff',   labelAr: 'موظف',        color: '#6366f1', icon: '👤',    isAdmin: false, sortOrder: 2 },
};

export function fillMissingKeys(partial: Partial<RolePermissions>): RolePermissions {
  return Object.fromEntries(
    ALL_PERMISSION_KEYS.map(k => [k, partial[k] ?? false])
  ) as RolePermissions;
}
