
export type Student = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  class: string;
  classId?: string;
  stream: string | null;
  section: 'RED' | 'YELLOW' | 'BLUE' | 'GREEN';
  gender: 'Male' | 'Female';
  guardianName: string;
  guardianPhone: string;
  dateOfBirth: string;
  avatar: string;
  admissionNumber: string;
  conduct?: string;
  interest?: string;
  classTeacherRemark?: string;
  headTeacherRemark?: string;
};

export type Teacher = {
  id: string;
  firstName: string;
  lastName:string;
  email: string;
  role: string;
  subjects: string[];
  phone: string;
  avatar: string;
  staffId: string;
  socialSecurityNumber: string;
  dateOf1stAppointment: string;
  datePostedToCurrentStation: string;
  lastDateOfPromotion: string;
  dateOfBirth: string;
  grade: string; // "1" - "9"
  rank: 'SUPT1' | 'SENIOR SUPT.2' | 'SENIOR SUPT.1' | 'PRINCIPAL SUPT' | 'ASSISTANT DIRECTOR 2' | 'ASSISTANT DIRECTOR 1' | 'DEPUTY DIRECTOR' | 'DIRECTOR' | 'DIRECTOR GENERAL';
  professionalQualification: string;
  academicQualification: string;
  nameOfBank: string;
  bankAccountNumber: string;
  bankBranch: string;
  ntcLicenseNumber: string;
  residentialAddress: string;
  maritalStatus: 'Single' | 'Married' | 'Divorced' | 'Widowed';
  religion: string;
  homeTown: string;
};

export type SubjectScore = {
  subject: string;
  test1: number;
  test2: number;
  groupWork: number;
  project: number;
  classExercises: number;
  homeWork: number;
  exam: number;
  classScore?: number;
  examScore?: number;
  total?: number;
  grade?: string;
  remark?: string;
};

export type AcademicRecord = {
  studentId: string;
  academicYear: string;
  term: number;
  scores: SubjectScore[];
};

export type Attendance = {
  studentId: string;
  date: string;
  status: 'Present' | 'Absent' | 'Late';
  time?: string;
};

export const academicYears = [
    '2024/2025',
    '2025/2026',
    '2026/2027',
    '2027/2028',
    '2028/2029',
    '2029/2030',
    '2030/2031'
];

export const terms = [1, 2, 3];

export const subjects = [
    'Mathematics',
    'English',
    'Science',
    'Social Studies',
    'Computing',
    'Ghanaian Language',
    'Creative Art',
    'Career Technology',
    'French',
    'Religious and Moral Studies'
];

export type GenerateStudentRemarksOutput = {
  teacherRemark: string;
  headTeacherRemark: string;
}
