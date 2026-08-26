// Pramaan Types & Database Entity Definitions matching PostgreSQL Schema (Migrations 001-017)

export type RoleName = 
  | 'INSTRUMENT_OWNER'
  | 'LMO'
  | 'GATC'
  | 'ADMIN'
  | 'PUBLIC_USER';

export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';

export interface User {
  id: string;
  role_id: RoleName;
  full_name: string;
  email: string;
  phone: string;
  organization_name?: string;
  address?: string;
  status: UserStatus;
  created_at: string;
  updated_at?: string;
}

export type InstrumentStatus = 
  | 'REGISTERED'
  | 'ACTIVE'
  | 'INACTIVE'
  | 'DECOMMISSIONED';

export interface InstrumentType {
  id: string;
  name: string;
  description: string;
  default_unit: string;
  is_active: boolean;
  created_at: string;
}

export interface Instrument {
  id: string;
  owner_id: string;
  owner_name?: string;
  instrument_type_id: string;
  instrument_type_name?: string;
  instrument_name: string;
  manufacturer: string;
  model: string;
  serial_number: string;
  registration_number: string | null;
  capacity: number;
  capacity_unit: string;
  accuracy_class: string;
  location_address: string;
  location_lat?: number;
  location_lng?: number;
  registration_date: string;
  status: InstrumentStatus;
  created_at: string;
  updated_at: string;
}

export type ApplicationType = 'VERIFICATION' | 'RE_VERIFICATION';

export type ApplicationStatus = 
  | 'DRAFT'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'SCHEDULED'
  | 'COMPLETED'
  | 'REJECTED'
  | 'CANCELLED';

export interface VerificationApplication {
  id: string;
  application_number: string;
  applicant_id: string;
  applicant_name?: string;
  applicant_organization?: string;
  instrument_id: string;
  instrument_name?: string;
  instrument_serial?: string;
  instrument_type_name?: string;
  application_type: ApplicationType;
  status: ApplicationStatus;
  purpose: string;
  remarks?: string;
  submitted_at?: string;
  created_at: string;
  updated_at: string;
  // Related details
  assignment?: VerificationAssignment;
  schedule?: VerificationSchedule;
  verification_id?: string;
  certificate_id?: string;
}

export type AssignmentStatus = 
  | 'ASSIGNED'
  | 'ACCEPTED'
  | 'DECLINED'
  | 'REASSIGNED'
  | 'COMPLETED';

export interface VerificationAssignment {
  id: string;
  application_id: string;
  assigned_to_id: string;
  assigned_to_name?: string;
  assigned_to_role?: 'LMO' | 'GATC';
  status: AssignmentStatus;
  assigned_at: string;
  remarks?: string;
}

export type ScheduleStatus = 
  | 'SCHEDULED'
  | 'RESCHEDULED'
  | 'COMPLETED'
  | 'CANCELLED';

export interface VerificationSchedule {
  id: string;
  application_id: string;
  assignment_id: string;
  scheduled_date: string;
  time_slot?: string;
  status: ScheduleStatus;
  created_at: string;
  notes?: string;
}

export type VerificationStatus = 
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'ABORTED';

export type ReadingResult = 'PASS' | 'FAIL';

export type VerificationDecision = 'PASS' | 'FAIL';

export interface InspectionObservation {
  id: string;
  verification_id: string;
  observation_type: string;
  observation_description?: string;
  observed_value: string;
  remarks?: string;
  observed_at: string;
}

export interface VerificationReading {
  id: string;
  verification_id: string;
  reading_type: string;
  expected_value: number;
  observed_value: number;
  unit: string;
  tolerance: number;
  result: ReadingResult;
  remarks?: string;
  recorded_at: string;
}

export interface VerificationResult {
  id: string;
  verification_id: string;
  decision: VerificationDecision;
  decided_by_id: string;
  decided_by_name?: string;
  result_date: string;
  remarks?: string;
  created_at: string;
}

export interface Verification {
  id: string;
  application_id: string;
  application_number?: string;
  assignment_id: string;
  schedule_id?: string;
  instrument_id: string;
  instrument_name?: string;
  instrument_serial?: string;
  performed_by_id: string;
  performed_by_name?: string;
  verification_date: string;
  start_time?: string;
  end_time?: string;
  location: string;
  status: VerificationStatus;
  remarks?: string;
  created_at: string;
  updated_at: string;
  observations: InspectionObservation[];
  readings: VerificationReading[];
  result?: VerificationResult;
  certificate?: VerificationCertificate;
}

export type CertificateStatus = 'ACTIVE' | 'EXPIRED' | 'REVOKED';

export interface VerificationCertificate {
  id: string;
  verification_id: string;
  instrument_id: string;
  instrument_name: string;
  instrument_serial: string;
  instrument_type_name: string;
  owner_name: string;
  owner_organization?: string;
  certificate_number: string;
  issue_date: string;
  valid_from: string;
  valid_until: string;
  status: CertificateStatus;
  certificate_file_url?: string;
  qr_token: string;
  verification_decision: 'PASS';
  issued_by_name: string;
  issued_by_designation: string;
  jurisdiction_zone: string;
  accuracy_class: string;
  capacity: number;
  capacity_unit: string;
  location_address: string;
  generated_at: string;
  created_at: string;
  updated_at: string;
}

export type QrAuthResult = 'VALID' | 'INVALID' | 'EXPIRED' | 'REVOKED';

export interface QrAuthenticationLog {
  id: string;
  certificate_id: string;
  result: QrAuthResult;
  access_source: string;
  ip_address?: string;
  user_agent?: string;
  authenticated_at: string;
}

export interface PublicVerificationLookupResult {
  authenticated: boolean;
  result: QrAuthResult;
  certificate?: VerificationCertificate;
  instrument?: {
    instrument_name: string;
    serial_number: string;
    manufacturer: string;
    model: string;
    capacity: number;
    capacity_unit: string;
    accuracy_class: string;
    location_address: string;
  };
  owner_name?: string;
  owner_organization?: string;
  verification_date?: string;
  officer_name?: string;
  remarks?: string;
}

// Chart and Insight Types
export interface CategoryApprovalStat {
  category: string;
  categoryLabel: string;
  approvals: number;
  fill: string;
}

export interface MonthlyTrendStat {
  month: string;
  submitted: number;
  approved: number;
  rejected: number;
  passRate: number;
}

export interface DashboardOverviewStats {
  totalInstruments: number;
  activeCertificates: number;
  pendingApplications: number;
  completedVerifications: number;
  passRatePercentage: number;
  recentActivity: Array<{
    id: string;
    type: 'INSTRUMENT' | 'APPLICATION' | 'VERIFICATION' | 'CERTIFICATE';
    title: string;
    description: string;
    timestamp: string;
    status: string;
  }>;
}
