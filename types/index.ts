export type Role = string;
export type AppointmentStatus = 'SCHEDULED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
export type ServiceStatus = 'PENDING' | 'IN_PROGRESS' | 'DELIVERED' | 'PARTIAL' | 'NOT_DELIVERED';
export type PaymentStatus = 'UNPAID' | 'PAID';
export type PaymentMethod = 'CASH' | 'CARD' | 'TRANSFER' | 'ONLINE' | 'VISA' | 'MASTERCARD' | 'PAYPAL' | 'APPLE_PAY';
export type ProviderType = 'DOCTOR' | 'STYLIST' | 'THERAPIST' | 'ESTHETICIAN' | 'NAIL_ARTIST';
export type CallStatus = 'COMPLETED' | 'NO_ANSWER' | 'FAILED';

export interface AuthUser {
  id: string;
  username: string;
  role: Role;
  branchId: string | null;
  branchName?: string;
  providerId?: string | null;
  token: string;
  email?: string | null;
  phone?: string | null;
}

export interface Branch {
  id: string;
  name: string;
  nameAr?: string | null;
  address?: string | null;
  phone?: string | null;
  createdAt: string;
}

export interface Customer {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  country?: string | null;
  branchId?: string | null;
  branch?: Branch | null;
  createdAt: string;
  _count?: { appointments: number };
}

export interface Service {
  id: string;
  name: string;
  nameAr?: string | null;
  price: number;
  description?: string | null;
  createdAt: string;
}

export interface ServiceProvider {
  id: string;
  name: string;
  type: ProviderType;
  bio?: string | null;
  photoUrl?: string | null;
  branchId?: string | null;
  branch?: Branch | null;
  linkedUser?: { id: string; username: string } | null;
  createdAt: string;
}

export interface Appointment {
  id: string;
  dateTime: string;
  status: AppointmentStatus;
  serviceStatus: ServiceStatus;
  paymentStatus: PaymentStatus;
  paymentMethod?: PaymentMethod | null;
  notes?: string | null;
  deliveryNotes?: string | null;
  nextVisit?: string | null;
  amount?: number | null;
  customerId?: string | null;
  customer?: Customer | null;
  serviceId?: string | null;
  service?: Service | null;
  serviceProviderId?: string | null;
  serviceProvider?: ServiceProvider | null;
  branchId?: string | null;
  branch?: Branch | null;
  createdAt: string;
  updatedAt: string;
}

export interface StaffAbsence {
  id: string;
  providerId?: string | null;
  provider?: ServiceProvider | null;
  userId?: string | null;
  user?: { id: string; username: string } | null;
  startDate: string;
  endDate: string;
  reason?: string | null;
  createdAt: string;
}

export interface CallLog {
  id: string;
  customerId?: string | null;
  customer?: Customer | null;
  customerName?: string | null;
  startedAt: string;
  endedAt?: string | null;
  durationSeconds?: number | null;
  status: CallStatus;
  notes?: string | null;
}

export interface DashboardStats {
  totalRevenue: number;
  totalCustomers: number;
  totalAppointments: number;
  totalProviders: number;
  totalServices: number;
  upcomingToday: number;
  noShows: number;
  unpaidCount: number;
  recentAppointments: Appointment[];
  upcomingAppointments: Appointment[];
}

export type Theme =
  | 'rose' | 'ocean' | 'forest' | 'sunset' | 'gold'
  | 'sapphire' | 'crimson' | 'amber' | 'emerald'
  | 'summer' | 'violet' | 'slate';

export type Language = 'en' | 'ar';
