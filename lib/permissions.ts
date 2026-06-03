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
  | 'sendBroadcasts' | 'sendWhatsApp' | 'sendSMS' | 'sendEmail'
  // v2 separated page permissions
  | 'viewCalendar'     // /calendar
  | 'viewRevenue'      // /revenue
  | 'manageProviders'  // /providers + /specialists
  | 'viewRoles'        // /roles
  | 'createRoles' | 'editRoles' | 'deleteRoles'
  // v3 granular action buttons
  | 'createServices'   | 'editServices'   | 'deleteServices'
  | 'createProviders'  | 'editProviders'  | 'deleteProviders'
  | 'createBranches'   | 'editBranches'   | 'deleteBranches'
  | 'createStaffAbsence' | 'editStaffAbsence' | 'deleteStaffAbsence'
  // v4 prescriptions
  | 'viewPrescriptions' | 'createPrescriptions' | 'editPrescriptions' | 'deletePrescriptions'
  // v5 medicines
  | 'manageMedicines' | 'createMedicines' | 'editMedicines' | 'deleteMedicines';

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
  'viewCalendar', 'viewRevenue', 'manageProviders', 'viewRoles',
  'createRoles', 'editRoles', 'deleteRoles',
  // v3
  'createServices', 'editServices', 'deleteServices',
  'createProviders', 'editProviders', 'deleteProviders',
  'createBranches', 'editBranches', 'deleteBranches',
  'createStaffAbsence', 'editStaffAbsence', 'deleteStaffAbsence',
  // v4 prescriptions
  'viewPrescriptions', 'createPrescriptions', 'editPrescriptions', 'deletePrescriptions',
  'manageMedicines', 'createMedicines', 'editMedicines', 'deleteMedicines',
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
    viewCalendar: true, viewRevenue: true, manageProviders: true, viewRoles: true,
    createRoles: true, editRoles: true, deleteRoles: true,
    createServices: true, editServices: true, deleteServices: true,
    createProviders: true, editProviders: true, deleteProviders: true,
    createBranches: true, editBranches: true, deleteBranches: true,
    createStaffAbsence: true, editStaffAbsence: true, deleteStaffAbsence: true,
    viewPrescriptions: true, createPrescriptions: true, editPrescriptions: true, deletePrescriptions: true,
    manageMedicines: true, createMedicines: true, editMedicines: true, deleteMedicines: true,
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
    viewCalendar: true, viewRevenue: true, manageProviders: true, viewRoles: true,
    createRoles: false, editRoles: true, deleteRoles: false,
    createServices: true, editServices: true, deleteServices: false,
    createProviders: true, editProviders: true, deleteProviders: false,
    createBranches: true, editBranches: true, deleteBranches: false,
    createStaffAbsence: true, editStaffAbsence: true, deleteStaffAbsence: false,
    viewPrescriptions: true, createPrescriptions: true, editPrescriptions: true, deletePrescriptions: false,
    manageMedicines: true, createMedicines: true, editMedicines: true, deleteMedicines: false,
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
    viewCalendar: true, viewRevenue: false, manageProviders: false, viewRoles: false,
    createRoles: false, editRoles: false, deleteRoles: false,
    createServices: false, editServices: false, deleteServices: false,
    createProviders: false, editProviders: false, deleteProviders: false,
    createBranches: false, editBranches: false, deleteBranches: false,
    manageStaffAbsence: true, createStaffAbsence: true, editStaffAbsence: true, deleteStaffAbsence: true,
    viewPrescriptions: true, createPrescriptions: false, editPrescriptions: false, deletePrescriptions: false,
    manageMedicines: false, createMedicines: false, editMedicines: false, deleteMedicines: false,
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
