
import * as XLSX from 'xlsx';
import type { Student, AcademicRecord, SubjectScore, Teacher } from '@/lib/types';
import { calculateScores } from '@/lib/grading';

// Helper function to sanitize objects before exporting to Excel or CSV
const sanitizeData = (data: any[]): any[] => {
  return data.map(item => {
    const newItem = { ...item };
    for (const key in newItem) {
      const val = newItem[key];
      if (typeof val === 'string') {
        // Strip out base64 avatar images or extremely long texts that exceed Excel cell limits (32767)
        if (val.startsWith('data:image/') || val.includes(';base64,') || val.length > 32767) {
          delete newItem[key];
        }
      } else if (val && typeof val === 'object') {
        // If it's a nested object/array, serialize and check length
        try {
          const str = JSON.stringify(val);
          if (str.length > 32767) {
            delete newItem[key];
          } else {
            newItem[key] = str;
          }
        } catch {
          delete newItem[key];
        }
      }
    }
    return newItem;
  });
};

// Utility function to export data to Excel
export const exportToExcel = (data: any[], fileName: string) => {
  const sanitized = sanitizeData(data);
  const worksheet = XLSX.utils.json_to_sheet(sanitized);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Students');
  XLSX.writeFile(workbook, `${fileName}.xlsx`);
};

export interface ParsedStudentRow {
  id?: string;
  firstName: string;
  lastName: string;
  email: string;
  class: string;
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
}

export interface ParsedImportResult {
  students: ParsedStudentRow[];
  rawCount: number;
  errors: string[];
  sheetName: string;
}

export function formatExcelDate(val: any): string {
  if (!val) return '';
  if (val instanceof Date && !isNaN(val.getTime())) {
    const year = val.getFullYear();
    const month = String(val.getMonth() + 1).padStart(2, '0');
    const day = String(val.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  if (typeof val === 'number' && val > 0) {
    try {
      const jsDate = new Date(Math.round((val - 25569) * 86400 * 1000));
      if (!isNaN(jsDate.getTime())) {
        const year = jsDate.getUTCFullYear();
        const month = String(jsDate.getUTCMonth() + 1).padStart(2, '0');
        const day = String(jsDate.getUTCDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      }
    } catch {
      // fallback
    }
  }
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed) return '';
    const dmy = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (dmy) {
      const day = dmy[1].padStart(2, '0');
      const month = dmy[2].padStart(2, '0');
      const year = dmy[3];
      return `${year}-${month}-${day}`;
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return trimmed;
    }
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    return trimmed;
  }
  return '';
}

export function normalizeGender(val: any): 'Male' | 'Female' {
  if (!val) return 'Male';
  const s = String(val).trim().toLowerCase();
  if (s.startsWith('f') || s === 'girl' || s === 'w' || s === 'woman') {
    return 'Female';
  }
  return 'Male';
}

export function normalizeSection(val: any): 'RED' | 'YELLOW' | 'BLUE' | 'GREEN' {
  if (!val) return 'RED';
  const s = String(val).trim().toUpperCase();
  if (s.includes('YELL')) return 'YELLOW';
  if (s.includes('BLU')) return 'BLUE';
  if (s.includes('GRE')) return 'GREEN';
  return 'RED';
}

export function normalizeClass(val: any): string {
  if (!val) return 'JHS1';
  const raw = String(val).trim();
  const s = raw.toUpperCase().replace(/\s+/g, '');
  if (s === '1' || s === 'BASIC7' || s === 'B7') return 'JHS1';
  if (s === '2' || s === 'BASIC8' || s === 'B8') return 'JHS2';
  if (s === '3' || s === 'BASIC9' || s === 'B9') return 'JHS3';
  if (s.startsWith('JHS') || s.startsWith('BASIC')) return s;
  return raw || 'JHS1';
}

export function normalizeStream(val: any): string | null {
  if (val === null || val === undefined) return 'A';
  const s = String(val).trim().toUpperCase();
  if (!s || s === 'NONE' || s === 'NULL' || s === '-') return null;
  return s;
}

export function normalizePhone(val: any): string {
  if (!val && val !== 0) return '0200000000';
  let s = String(val).trim().replace(/[^\d+]/g, '');
  if (s.length === 9 && !s.startsWith('0') && !s.startsWith('+')) {
    s = '0' + s;
  }
  return s || '0200000000';
}

/**
 * Safely and robustly reads a File or Blob into an ArrayBuffer in browser environments.
 * Handles transient file locks (e.g. file open in Excel), detached file inputs,
 * and falls back through file.arrayBuffer(), FileReader, and blob slices.
 */
export async function readFileAsArrayBuffer(fileOrBuffer: File | Blob | ArrayBuffer): Promise<ArrayBuffer> {
  if (fileOrBuffer instanceof ArrayBuffer) {
    return fileOrBuffer;
  }
  if (!fileOrBuffer) {
    throw new Error('No file provided for reading.');
  }

  // Method 1: file.arrayBuffer()
  try {
    if (typeof (fileOrBuffer as any).arrayBuffer === 'function') {
      const buf = await (fileOrBuffer as any).arrayBuffer();
      if (buf && buf.byteLength !== undefined) {
        return buf;
      }
    }
  } catch (err: any) {
    console.warn('file.arrayBuffer() failed, trying FileReader fallback:', err);
  }

  // Method 2: FileReader
  try {
    return await new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (reader.result instanceof ArrayBuffer) {
          resolve(reader.result);
        } else {
          reject(new Error('FileReader did not return an ArrayBuffer'));
        }
      };
      reader.onerror = () => {
        reject(reader.error || new Error('FileReader failed to read file'));
      };
      reader.onabort = () => {
        reject(new Error('File reading was aborted'));
      };
      reader.readAsArrayBuffer(fileOrBuffer as Blob);
    });
  } catch (err: any) {
    console.warn('FileReader failed, trying blob slice fallback:', err);
  }

  // Method 3: Blob slice fallback (creates fresh detached copy of file stream)
  try {
    const blob = (fileOrBuffer as Blob).slice(0, (fileOrBuffer as Blob).size);
    if (typeof (blob as any).arrayBuffer === 'function') {
      return await (blob as any).arrayBuffer();
    }
    return await new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (reader.result instanceof ArrayBuffer) {
          resolve(reader.result);
        } else {
          reject(new Error('FileReader slice failed'));
        }
      };
      reader.onerror = () => reject(reader.error || new Error('Failed to read blob'));
      reader.readAsArrayBuffer(blob);
    });
  } catch (err: any) {
    const rawMsg = err?.message || String(err);
    if (
      rawMsg.includes('permission problems') ||
      rawMsg.includes('could not be read') ||
      rawMsg.includes('NotReadableError')
    ) {
      throw new Error(
        'The spreadsheet could not be read because it may be open or locked by Microsoft Excel or another program. Please close the file in Excel, or save a copy, and try uploading again.'
      );
    }
    throw err;
  }
}

export async function parseStudentsFromExcel(fileOrBuffer: File | ArrayBuffer): Promise<ParsedImportResult> {
  const buffer = await readFileAsArrayBuffer(fileOrBuffer);
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  
  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new Error('The uploaded spreadsheet contains no sheets.');
  }

  // Find sheet: either one named 'students' (case-insensitive) or the first sheet
  const targetSheetName = 
    workbook.SheetNames.find(name => name.toLowerCase().includes('student')) || 
    workbook.SheetNames[0];

  const worksheet = workbook.Sheets[targetSheetName];
  if (!worksheet) {
    throw new Error(`Sheet "${targetSheetName}" could not be read.`);
  }

  const rawRows = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: '' });
  const students: ParsedStudentRow[] = [];
  const errors: string[] = [];

  rawRows.forEach((row, index) => {
    const rowNum = index + 2; // header is row 1
    const cleanRow: Record<string, any> = {};

    for (const [key, value] of Object.entries(row)) {
      if (value === null || value === undefined) continue;
      const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');

      if (['firstname', 'first', 'fname', 'givenname', 'forename'].includes(normalizedKey)) {
        cleanRow.firstName = String(value).trim();
      } else if (['lastname', 'last', 'lname', 'surname', 'familyname'].includes(normalizedKey)) {
        cleanRow.lastName = String(value).trim();
      } else if (['name', 'fullname', 'studentname'].includes(normalizedKey)) {
        cleanRow.fullName = String(value).trim();
      } else if (['admissionnumber', 'admissionno', 'admission', 'admno', 'studentno', 'studentid', 'idnumber', 'studentadmno', 'regno'].includes(normalizedKey)) {
        cleanRow.admissionNumber = String(value).trim();
      } else if (['class', 'classlevel', 'grade', 'form', 'level'].includes(normalizedKey)) {
        cleanRow.class = normalizeClass(value);
      } else if (['stream', 'division', 'arm'].includes(normalizedKey)) {
        cleanRow.stream = normalizeStream(value);
      } else if (['section', 'house', 'color'].includes(normalizedKey)) {
        cleanRow.section = normalizeSection(value);
      } else if (['gender', 'sex'].includes(normalizedKey)) {
        cleanRow.gender = normalizeGender(value);
      } else if (['email', 'emailaddress', 'studentemail'].includes(normalizedKey)) {
        cleanRow.email = String(value).trim();
      } else if (['guardianname', 'parentname', 'guardian', 'parent', 'fathername', 'mothername'].includes(normalizedKey)) {
        cleanRow.guardianName = String(value).trim();
      } else if (['guardianphone', 'parentphone', 'phone', 'phonenumber', 'telephone', 'contact', 'mobile'].includes(normalizedKey)) {
        cleanRow.guardianPhone = normalizePhone(value);
      } else if (['dateofbirth', 'dob', 'birthdate', 'birth'].includes(normalizedKey)) {
        cleanRow.dateOfBirth = formatExcelDate(value);
      } else if (['conduct', 'behavior', 'behaviour'].includes(normalizedKey)) {
        cleanRow.conduct = String(value).trim();
      } else if (['interest', 'interests', 'hobby', 'hobbies'].includes(normalizedKey)) {
        cleanRow.interest = String(value).trim();
      } else if (['classteacherremark', 'teacherremark', 'remark'].includes(normalizedKey)) {
        cleanRow.classTeacherRemark = String(value).trim();
      } else if (['headteacherremark', 'headmasterremark', 'principalremark'].includes(normalizedKey)) {
        cleanRow.headTeacherRemark = String(value).trim();
      } else if (['avatar', 'photo'].includes(normalizedKey)) {
        cleanRow.avatar = String(value).trim();
      } else if (normalizedKey === 'id') {
        cleanRow.id = String(value).trim();
      }
    }

    // If only fullName was provided
    if (cleanRow.fullName && !cleanRow.firstName) {
      const parts = cleanRow.fullName.split(/\s+/);
      cleanRow.firstName = parts[0];
      cleanRow.lastName = parts.slice(1).join(' ') || parts[0];
    }

    // Check if row has any meaningful identity
    if (!cleanRow.firstName && !cleanRow.lastName && !cleanRow.admissionNumber) {
      // Empty or spacer row, skip without logging error
      return;
    }

    if (!cleanRow.firstName) {
      errors.push(`Row ${rowNum}: Skipped due to missing first name.`);
      return;
    }

    const firstName = cleanRow.firstName;
    const lastName = cleanRow.lastName || firstName;
    const admissionNumber = cleanRow.admissionNumber || `UP/${new Date().getFullYear()}/${String(students.length + 1).padStart(3, '0')}`;
    let avatar = cleanRow.avatar || `https://picsum.photos/seed/${encodeURIComponent(admissionNumber)}/150/150`;
    if (avatar && avatar.startsWith('data:image/') && avatar.length > 80 * 1024) {
      avatar = `https://picsum.photos/seed/${encodeURIComponent(admissionNumber)}/150/150`;
    }

    students.push({
      ...(cleanRow.id ? { id: cleanRow.id } : {}),
      firstName,
      lastName,
      email,
      class: cleanRow.class || 'JHS1',
      stream: cleanRow.stream !== undefined ? cleanRow.stream : 'A',
      section: cleanRow.section || 'RED',
      gender: cleanRow.gender || 'Male',
      guardianName: cleanRow.guardianName || 'Parent / Guardian',
      guardianPhone: cleanRow.guardianPhone || '0200000000',
      dateOfBirth: cleanRow.dateOfBirth || '2011-01-01',
      avatar,
      admissionNumber,
      ...(cleanRow.conduct ? { conduct: cleanRow.conduct } : {}),
      ...(cleanRow.interest ? { interest: cleanRow.interest } : {}),
      ...(cleanRow.classTeacherRemark ? { classTeacherRemark: cleanRow.classTeacherRemark } : {}),
      ...(cleanRow.headTeacherRemark ? { headTeacherRemark: cleanRow.headTeacherRemark } : {}),
    });
  });

  return {
    students,
    rawCount: rawRows.length,
    errors,
    sheetName: targetSheetName,
  };
}

export const downloadStudentTemplateExcel = () => {
  const templateData = [
    {
      'Admission Number': 'UP/2026/001',
      'First Name': 'Kwabena',
      'Last Name': 'Owusu',
      'Gender': 'Male',
      'Class': 'JHS1',
      'Stream': 'A',
      'Section': 'RED',
      'Date of Birth': '2011-05-14',
      'Email': 'kwabena.owusu@student.upnjhs.ac.pg',
      'Guardian Name': 'Samuel Owusu',
      'Guardian Phone': '0244123456',
      'Conduct': 'Respectful, obedient and hardworking',
      'Interest': 'Science Club, Football'
    },
    {
      'Admission Number': 'UP/2026/002',
      'First Name': 'Akosua',
      'Last Name': 'Mensah',
      'Gender': 'Female',
      'Class': 'JHS1',
      'Stream': 'B',
      'Section': 'YELLOW',
      'Date of Birth': '2011-08-22',
      'Email': 'akosua.mensah@student.upnjhs.ac.pg',
      'Guardian Name': 'Grace Mensah',
      'Guardian Phone': '0244987654',
      'Conduct': 'Very punctual, polite and attentive in class',
      'Interest': 'Debate Society, Reading'
    },
    {
      'Admission Number': 'UP/2026/003',
      'First Name': 'Emmanuel',
      'Last Name': 'Appiah',
      'Gender': 'Male',
      'Class': 'JHS2',
      'Stream': 'A',
      'Section': 'BLUE',
      'Date of Birth': '2010-02-19',
      'Email': 'emmanuel.appiah@student.upnjhs.ac.pg',
      'Guardian Name': 'Peter Appiah',
      'Guardian Phone': '0208112233',
      'Conduct': 'Demonstrates strong leadership and diligence',
      'Interest': 'Mathematics Club, Athletics'
    }
  ];

  const worksheet = XLSX.utils.json_to_sheet(templateData);
  worksheet['!cols'] = [
    { wch: 18 },
    { wch: 15 },
    { wch: 15 },
    { wch: 10 },
    { wch: 10 },
    { wch: 10 },
    { wch: 10 },
    { wch: 14 },
    { wch: 32 },
    { wch: 20 },
    { wch: 16 },
    { wch: 35 },
    { wch: 30 },
  ];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Students_Template');
  XLSX.writeFile(workbook, 'UP_JHS_Students_Import_Template.xlsx');
};

// New function for generic report export
export const exportReport = (data: any[], fileName: string, isCsv = false) => {
  const sanitized = sanitizeData(data);
  const worksheet = XLSX.utils.json_to_sheet(sanitized);
  
  if (isCsv) {
      const csv = XLSX.utils.sheet_to_csv(worksheet);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  } else {
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'ReportData');
      XLSX.writeFile(workbook, fileName);
  }
};

export const exportGradeAnalysisToExcel = (gradeData: any[], statsData: any[], fileName: string) => {
    const sanitizedGrades = sanitizeData(gradeData);
    const sanitizedStats = sanitizeData(statsData);
    const gradeWorksheet = XLSX.utils.json_to_sheet(sanitizedGrades);
    const statsWorksheet = XLSX.utils.json_to_sheet(sanitizedStats);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, gradeWorksheet, 'Grade Count');
    XLSX.utils.book_append_sheet(workbook, statsWorksheet, 'Statistics');
    XLSX.writeFile(workbook, `${fileName}.xlsx`);
};

export interface ParsedScoreRow {
  studentId?: string;
  admissionNumber: string;
  studentName?: string;
  class: string;
  stream: string | null;
  academicYear: string;
  term: number;
  subject: string;
  test1: number;
  test2: number;
  groupWork: number;
  project: number;
  classExercises: number;
  homeWork: number;
  exam: number;
  classScore: number;
  examScore: number;
  total: number;
  grade: string;
  remark: string;
  status: 'ready' | 'student_not_found' | 'warning';
  statusMessage?: string;
}

export interface ParsedScoresImportResult {
  scores: ParsedScoreRow[];
  rawCount: number;
  errors: string[];
  sheetName: string;
}

const defaultAcademicScoreSettings = {
  test1: 100,
  test2: 100,
  groupWork: 50,
  project: 50,
  classExercises: 20,
  homeWork: 20,
  exam: 100,
};

export const downloadAcademicScoresTemplateExcel = (options?: {
  students?: Student[];
  selectedClass?: string;
  selectedStream?: string;
  selectedSubject?: string;
  selectedAcademicYear?: string;
  selectedTerm?: number;
}) => {
  const {
    students = [],
    selectedClass,
    selectedStream,
    selectedSubject = 'Mathematics',
    selectedAcademicYear = '2024/2025',
    selectedTerm = 1,
  } = options || {};

  // Filter students if class/stream is specified
  let targetStudents = students;
  if (selectedClass && selectedClass !== 'all') {
    targetStudents = targetStudents.filter(s => s.class === selectedClass);
  }
  if (selectedStream && selectedStream !== 'all') {
    targetStudents = targetStudents.filter(s => !s.stream || s.stream === selectedStream);
  }

  let templateData: any[] = [];

  if (targetStudents.length > 0) {
    templateData = targetStudents.map(student => ({
      'Admission Number': student.admissionNumber || '',
      'Student Name': `${student.firstName} ${student.lastName}`.trim(),
      'Class': student.class || selectedClass || 'JHS1',
      'Stream': student.stream || selectedStream || 'A',
      'Academic Year': selectedAcademicYear,
      'Term': selectedTerm,
      'Subject': selectedSubject || 'Mathematics',
      'Test 1': '',
      'Test 2': '',
      'Group Work': '',
      'Project': '',
      'Class Exercises': '',
      'Home Work': '',
      'Exam': '',
    }));
  } else {
    // Realistic standard sample rows
    templateData = [
      {
        'Admission Number': 'JHS/2023/001',
        'Student Name': 'Edward Ansu Prempeh',
        'Class': selectedClass || 'JHS1',
        'Stream': selectedStream || 'A',
        'Academic Year': selectedAcademicYear,
        'Term': selectedTerm,
        'Subject': selectedSubject || 'Mathematics',
        'Test 1': 85,
        'Test 2': 88,
        'Group Work': 45,
        'Project': 42,
        'Class Exercises': 18,
        'Home Work': 19,
        'Exam': 80,
      },
      {
        'Admission Number': 'JHS/2023/002',
        'Student Name': 'Akosua Mensah',
        'Class': selectedClass || 'JHS1',
        'Stream': selectedStream || 'A',
        'Academic Year': selectedAcademicYear,
        'Term': selectedTerm,
        'Subject': selectedSubject || 'Mathematics',
        'Test 1': 78,
        'Test 2': 82,
        'Group Work': 40,
        'Project': 46,
        'Class Exercises': 17,
        'Home Work': 18,
        'Exam': 75,
      },
      {
        'Admission Number': 'JHS/2023/003',
        'Student Name': 'Emmanuel Appiah',
        'Class': selectedClass || 'JHS1',
        'Stream': selectedStream || 'A',
        'Academic Year': selectedAcademicYear,
        'Term': selectedTerm,
        'Subject': selectedSubject || 'Mathematics',
        'Test 1': 92,
        'Test 2': 90,
        'Group Work': 48,
        'Project': 45,
        'Class Exercises': 20,
        'Home Work': 20,
        'Exam': 90,
      },
    ];
  }

  const worksheet = XLSX.utils.json_to_sheet(templateData);
  worksheet['!cols'] = [
    { wch: 18 }, // Admission Number
    { wch: 24 }, // Student Name
    { wch: 12 }, // Class
    { wch: 10 }, // Stream
    { wch: 15 }, // Academic Year
    { wch: 10 }, // Term
    { wch: 22 }, // Subject
    { wch: 12 }, // Test 1
    { wch: 12 }, // Test 2
    { wch: 14 }, // Group Work
    { wch: 12 }, // Project
    { wch: 16 }, // Class Exercises
    { wch: 14 }, // Home Work
    { wch: 12 }, // Exam
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Score_Entry_Template');

  const classTag = selectedClass && selectedClass !== 'all' ? `_${selectedClass}` : '';
  const streamTag = selectedStream && selectedStream !== 'all' ? `_${selectedStream}` : '';
  const subjectTag = selectedSubject ? `_${selectedSubject.replace(/\s+/g, '_')}` : '';
  XLSX.writeFile(workbook, `UP_JHS_Scores_Template${classTag}${streamTag}${subjectTag}.xlsx`);
};

export async function parseAcademicScoresFromExcel(
  fileOrBuffer: File | ArrayBuffer,
  existingStudents: Student[],
  scoreSettings: any = defaultAcademicScoreSettings,
  defaults?: {
    academicYear?: string;
    term?: number;
    subject?: string;
    class?: string;
  }
): Promise<ParsedScoresImportResult> {
  const buffer = await readFileAsArrayBuffer(fileOrBuffer);
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error('The uploaded Excel file contains no worksheets.');
  }

  const worksheet = workbook.Sheets[sheetName];
  const rawRows: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

  const errors: string[] = [];
  const parsedScores: ParsedScoreRow[] = [];

  // Create fast lookup maps for existing students
  const studentByAdm = new Map<string, Student>();
  const studentByName = new Map<string, Student>();
  const studentById = new Map<string, Student>();

  existingStudents.forEach(s => {
    if (s.id) studentById.set(s.id, s);
    if (s.admissionNumber) {
      studentByAdm.set(s.admissionNumber.trim().toLowerCase(), s);
    }
    const fullName = `${s.firstName || ''} ${s.lastName || ''}`.trim().toLowerCase();
    if (fullName) {
      studentByName.set(fullName, s);
    }
  });

  const getVal = (row: any, ...keys: string[]) => {
    for (const key of keys) {
      if (row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== '') {
        return row[key];
      }
    }
    const lowerKeyMap: { [k: string]: any } = {};
    for (const k in row) {
      lowerKeyMap[k.trim().toLowerCase()] = row[k];
    }
    for (const key of keys) {
      const lk = key.trim().toLowerCase();
      if (lowerKeyMap[lk] !== undefined && lowerKeyMap[lk] !== null && String(lowerKeyMap[lk]).trim() !== '') {
        return lowerKeyMap[lk];
      }
    }
    return '';
  };

  const parseScoreNum = (val: any, max: number): number => {
    if (val === '' || val === null || val === undefined) return 0;
    const n = Number(val);
    if (isNaN(n) || n < 0) return 0;
    return Math.min(Math.round(n), max);
  };

  rawRows.forEach((row, idx) => {
    const rowNum = idx + 2;

    const admVal = String(getVal(row, 'Admission Number', 'Admission No', 'Adm No', 'AdmNo', 'AdmissionNo', 'Index Number', 'Index No', 'ID', 'Student ID')).trim();
    const nameVal = String(getVal(row, 'Student Name', 'Name', 'Full Name', 'Student')).trim();

    // Skip blank filler rows
    if (!admVal && !nameVal) {
      return;
    }

    const classVal = String(getVal(row, 'Class', 'Class Level', 'Grade') || defaults?.class || 'JHS1').trim();
    const streamVal = String(getVal(row, 'Stream', 'Arm', 'Section') || '').trim() || null;
    const yearVal = String(getVal(row, 'Academic Year', 'Year', 'Session') || defaults?.academicYear || '2024/2025').trim();
    const termRaw = getVal(row, 'Term', 'Semester') || defaults?.term || 1;
    const termVal = Number(termRaw) || 1;
    const subjectVal = String(getVal(row, 'Subject', 'Course') || defaults?.subject || '').trim();

    if (!subjectVal) {
      errors.push(`Row ${rowNum}: Missing subject for student ${nameVal || admVal || 'Unknown'}.`);
      return;
    }

    // Match student
    let matchedStudent: Student | undefined;
    if (admVal) {
      matchedStudent = studentByAdm.get(admVal.toLowerCase());
    }
    if (!matchedStudent && nameVal) {
      matchedStudent = studentByName.get(nameVal.toLowerCase());
    }

    // Parse scores
    const currentSettings = scoreSettings || defaultAcademicScoreSettings;
    const test1 = parseScoreNum(getVal(row, 'Test 1', 'Test1', 'Class Test 1', 'Assignment 1', 'T1'), currentSettings.test1 || 100);
    const test2 = parseScoreNum(getVal(row, 'Test 2', 'Test2', 'Class Test 2', 'Assignment 2', 'T2'), currentSettings.test2 || 100);
    const groupWork = parseScoreNum(getVal(row, 'Group Work', 'Groupwork', 'Group Work (50)', 'GW'), currentSettings.groupWork || 50);
    const project = parseScoreNum(getVal(row, 'Project', 'Project (50)', 'Proj'), currentSettings.project || 50);
    const classExercises = parseScoreNum(getVal(row, 'Class Exercises', 'Class Exercise', 'Exercises', 'Exercise', 'CE'), currentSettings.classExercises || 20);
    const homeWork = parseScoreNum(getVal(row, 'Home Work', 'Homework', 'HW'), currentSettings.homeWork || 20);
    const exam = parseScoreNum(getVal(row, 'Exam', 'Examination', 'Exams', 'Exam Score', 'End of Term Exam'), currentSettings.exam || 100);

    const calculated = calculateScores(
      { test1, test2, groupWork, project, classExercises, homeWork, exam },
      currentSettings
    );

    let status: 'ready' | 'student_not_found' | 'warning' = 'ready';
    let statusMessage: string | undefined;

    if (!matchedStudent) {
      status = 'student_not_found';
      statusMessage = admVal ? `Admission No "${admVal}" not found in students directory` : `Student "${nameVal}" not found in directory`;
    }

    parsedScores.push({
      studentId: matchedStudent?.id,
      admissionNumber: admVal || matchedStudent?.admissionNumber || '',
      studentName: nameVal || (matchedStudent ? `${matchedStudent.firstName} ${matchedStudent.lastName}`.trim() : 'Unknown Student'),
      class: matchedStudent?.class || classVal,
      stream: matchedStudent?.stream !== undefined ? matchedStudent.stream : streamVal,
      academicYear: yearVal,
      term: termVal,
      subject: subjectVal,
      test1,
      test2,
      groupWork,
      project,
      classExercises,
      homeWork,
      exam,
      classScore: calculated.classScore,
      examScore: calculated.examScore,
      total: calculated.total,
      grade: calculated.grade ?? 'N/A',
      remark: calculated.remark ?? 'N/A',
      status,
      statusMessage,
    });
  });

  return {
    scores: parsedScores,
    rawCount: rawRows.length,
    errors,
    sheetName,
  };
}

export const exportAcademicScoresToExcel = (
  records: AcademicRecord[],
  students: Student[],
  filterOptions?: {
    className?: string;
    stream?: string;
    academicYear?: string;
    term?: number;
    subject?: string;
    scoreSettings?: any;
  }
) => {
  const { className, stream, academicYear, term, subject } = filterOptions || {};

  const studentMap = new Map<string, Student>();
  students.forEach(s => {
    if (s.id) studentMap.set(s.id, s);
  });

  const rows: any[] = [];

  records.forEach(rec => {
    if (academicYear && rec.academicYear !== academicYear) return;
    if (term && rec.term !== term) return;

    const student = studentMap.get(rec.studentId);
    if (!student) return;
    if (className && className !== 'all' && student.class !== className) return;
    if (stream && stream !== 'all' && student.stream !== stream) return;

    rec.scores.forEach(sc => {
      if (subject && subject !== 'all' && sc.subject !== subject) return;

      rows.push({
        'Admission Number': student.admissionNumber || '',
        'Student Name': `${student.firstName} ${student.lastName}`.trim(),
        'Class': student.class,
        'Stream': student.stream || 'A',
        'Academic Year': rec.academicYear,
        'Term': `Term ${rec.term}`,
        'Subject': sc.subject,
        'Test 1': sc.test1 ?? 0,
        'Test 2': sc.test2 ?? 0,
        'Group Work': sc.groupWork ?? 0,
        'Project': sc.project ?? 0,
        'Class Exercises': sc.classExercises ?? 0,
        'Home Work': sc.homeWork ?? 0,
        'Class Score (50%)': sc.classScore ?? 0,
        'Exam': sc.exam ?? 0,
        'Exam Score (50%)': sc.examScore ?? 0,
        'Total (100%)': sc.total ?? 0,
        'Grade': sc.grade || 'N/A',
        'Remark': sc.remark || 'N/A',
      });
    });
  });

  // If no scores exist yet for the filter, export student list with 0 scores so user can fill them
  if (rows.length === 0 && students.length > 0) {
    const filteredStudents = students.filter(s => 
      (!className || className === 'all' || s.class === className) &&
      (!stream || stream === 'all' || s.stream === stream)
    );

    filteredStudents.forEach(student => {
      rows.push({
        'Admission Number': student.admissionNumber || '',
        'Student Name': `${student.firstName} ${student.lastName}`.trim(),
        'Class': student.class,
        'Stream': student.stream || 'A',
        'Academic Year': academicYear || '2024/2025',
        'Term': term ? `Term ${term}` : 'Term 1',
        'Subject': subject && subject !== 'all' ? subject : 'Mathematics',
        'Test 1': 0,
        'Test 2': 0,
        'Group Work': 0,
        'Project': 0,
        'Class Exercises': 0,
        'Home Work': 0,
        'Class Score (50%)': 0,
        'Exam': 0,
        'Exam Score (50%)': 0,
        'Total (100%)': 0,
        'Grade': 'N/A',
        'Remark': 'N/A',
      });
    });
  }

  const sanitized = sanitizeData(rows);
  const worksheet = XLSX.utils.json_to_sheet(sanitized);

  worksheet['!cols'] = [
    { wch: 18 }, // Admission Number
    { wch: 25 }, // Student Name
    { wch: 12 }, // Class
    { wch: 10 }, // Stream
    { wch: 15 }, // Academic Year
    { wch: 10 }, // Term
    { wch: 22 }, // Subject
    { wch: 10 }, // Test 1
    { wch: 10 }, // Test 2
    { wch: 12 }, // Group Work
    { wch: 10 }, // Project
    { wch: 15 }, // Class Exercises
    { wch: 12 }, // Home Work
    { wch: 16 }, // Class Score
    { wch: 10 }, // Exam
    { wch: 16 }, // Exam Score
    { wch: 14 }, // Total
    { wch: 10 }, // Grade
    { wch: 18 }, // Remark
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Academic_Scores');

  const fileClass = className && className !== 'all' ? `${className}_` : '';
  const fileSubject = subject && subject !== 'all' ? `${subject.replace(/\s+/g, '_')}_` : '';
  const fileYear = (academicYear || '2024-2025').replace(/\//g, '-');
  XLSX.writeFile(workbook, `UP_JHS_${fileClass}${fileSubject}Scores_${fileYear}.xlsx`);
};

// =========================================================================
// TEACHER DIRECTORY EXCEL IMPORT & EXPORT
// =========================================================================

export interface ParsedTeacherRow {
  id?: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: string;
  subjects: string[];
  avatar: string;
  staffId: string;
  socialSecurityNumber: string;
  dateOfBirth: string;
  dateOf1stAppointment: string;
  datePostedToCurrentStation: string;
  lastDateOfPromotion: string;
  grade: string;
  rank: Teacher['rank'];
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
}

export interface ParsedTeacherImportResult {
  teachers: ParsedTeacherRow[];
  rawCount: number;
  errors: string[];
  sheetName: string;
}

export function normalizeTeacherRank(val: any): Teacher['rank'] {
  if (!val) return 'SUPT1';
  const s = String(val).trim().toUpperCase();
  if (s.includes('DIR') && s.includes('GEN')) return 'DIRECTOR GENERAL';
  if (s.includes('DEP') && s.includes('DIR')) return 'DEPUTY DIRECTOR';
  if (s.includes('ASS') && s.includes('DIR') && s.includes('1')) return 'ASSISTANT DIRECTOR 1';
  if (s.includes('ASS') && s.includes('DIR') && s.includes('2')) return 'ASSISTANT DIRECTOR 2';
  if (s.includes('DIRECTOR')) return 'DIRECTOR';
  if (s.includes('PRIN')) return 'PRINCIPAL SUPT';
  if (s.includes('SEN') && (s.includes('1') || s.includes('.1'))) return 'SENIOR SUPT.1';
  if (s.includes('SEN') && (s.includes('2') || s.includes('.2'))) return 'SENIOR SUPT.2';
  if (s.includes('SUPT') && s.includes('1')) return 'SUPT1';
  if (s.includes('SUPT')) return 'SUPT1';
  return 'SUPT1';
}

export function normalizeTeacherGrade(val: any): string {
  if (!val) return '1';
  const clean = String(val).replace(/[^0-9]/g, '');
  if (clean && parseInt(clean, 10) >= 1 && parseInt(clean, 10) <= 9) {
    return clean;
  }
  return '1';
}

export function normalizeMaritalStatus(val: any): 'Single' | 'Married' | 'Divorced' | 'Widowed' {
  if (!val) return 'Single';
  const s = String(val).trim().toLowerCase();
  if (s.startsWith('m')) return 'Married';
  if (s.startsWith('d')) return 'Divorced';
  if (s.startsWith('w')) return 'Widowed';
  return 'Single';
}

export function normalizeTeacherSubjects(val: any): string[] {
  if (!val) return ['Mathematics'];
  if (Array.isArray(val)) {
    const list = val.map(v => String(v).trim()).filter(Boolean);
    return list.length > 0 ? list : ['Mathematics'];
  }
  const str = String(val).trim();
  if (str.startsWith('[') && str.endsWith(']')) {
    try {
      const parsed = JSON.parse(str);
      if (Array.isArray(parsed)) {
        return parsed.map(v => String(v).trim()).filter(Boolean);
      }
    } catch {
      // fallback
    }
  }
  const parts = str.split(/[,;\/|]/).map(s => s.trim()).filter(Boolean);
  return parts.length > 0 ? parts : ['Mathematics'];
}

// Export teachers to Excel with clean headers and formatting
export const exportTeachersToExcel = (teachers: Teacher[], fileName = 'teachers_directory') => {
  const rows = (teachers || []).map((t) => ({
    'Staff ID': t.staffId || '',
    'First Name': t.firstName || '',
    'Last Name': t.lastName || '',
    'Email': t.email || '',
    'Phone Number': t.phone || '',
    'Role': t.role || '',
    'Subjects': Array.isArray(t.subjects) ? t.subjects.join(', ') : (t.subjects || ''),
    'Rank': t.rank || 'SUPT1',
    'Grade': t.grade || '1',
    'Date of Birth': t.dateOfBirth || '',
    'Social Security Number (SSN)': t.socialSecurityNumber || '',
    'Date of 1st Appointment': t.dateOf1stAppointment || '',
    'Date Posted to Current Station': t.datePostedToCurrentStation || '',
    'Last Date of Promotion': t.lastDateOfPromotion || '',
    'Professional Qualification': t.professionalQualification || '',
    'Academic Qualification': t.academicQualification || '',
    'Name of Bank': t.nameOfBank || '',
    'Bank Account Number': t.bankAccountNumber || '',
    'Bank Branch': t.bankBranch || '',
    'NTC License Number': t.ntcLicenseNumber || '',
    'Residential Address': t.residentialAddress || '',
    'Home Town': t.homeTown || '',
    'Marital Status': t.maritalStatus || 'Single',
    'Religion': t.religion || '',
  }));

  const sanitized = sanitizeData(rows);
  const worksheet = XLSX.utils.json_to_sheet(sanitized);

  worksheet['!cols'] = [
    { wch: 16 }, // Staff ID
    { wch: 16 }, // First Name
    { wch: 16 }, // Last Name
    { wch: 28 }, // Email
    { wch: 16 }, // Phone Number
    { wch: 18 }, // Role
    { wch: 28 }, // Subjects
    { wch: 22 }, // Rank
    { wch: 8 },  // Grade
    { wch: 14 }, // Date of Birth
    { wch: 20 }, // SSN
    { wch: 18 }, // Date of 1st Appointment
    { wch: 20 }, // Date Posted to Station
    { wch: 18 }, // Last Date of Promotion
    { wch: 26 }, // Professional Qualification
    { wch: 24 }, // Academic Qualification
    { wch: 18 }, // Name of Bank
    { wch: 20 }, // Bank Account Number
    { wch: 18 }, // Bank Branch
    { wch: 20 }, // NTC License Number
    { wch: 30 }, // Residential Address
    { wch: 16 }, // Home Town
    { wch: 14 }, // Marital Status
    { wch: 16 }, // Religion
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Teachers');
  XLSX.writeFile(workbook, `${fileName}.xlsx`);
};

// Download official Excel template for teacher data entry & batch import
export const downloadTeacherTemplateExcel = () => {
  const templateData = [
    {
      'Staff ID': 'TEA-2024-001',
      'First Name': 'Kwame',
      'Last Name': 'Ansah',
      'Email': 'kwame.ansah@upnjhs.ac.pg',
      'Phone Number': '0244123456',
      'Role': 'Class Teacher',
      'Subjects': 'Mathematics, Integrated Science',
      'Rank': 'PRINCIPAL SUPT',
      'Grade': '7',
      'Date of Birth': '1986-04-12',
      'Social Security Number': 'C012345678901',
      'Date of 1st Appointment': '2012-09-01',
      'Date Posted to Current Station': '2019-01-15',
      'Last Date of Promotion': '2022-11-01',
      'Professional Qualification': 'B.Ed Basic Education (Mathematics)',
      'Academic Qualification': 'B.Sc Mathematics',
      'Name of Bank': 'GCB Bank',
      'Bank Account Number': '1021000123456',
      'Bank Branch': 'Legon Branch',
      'NTC License Number': 'PT/2019/00123',
      'Residential Address': 'House No 14, Ring Road Central, Accra',
      'Home Town': 'Cape Coast',
      'Marital Status': 'Married',
      'Religion': 'Christianity'
    },
    {
      'Staff ID': 'TEA-2024-002',
      'First Name': 'Abena',
      'Last Name': 'Osei',
      'Email': 'abena.osei@upnjhs.ac.pg',
      'Phone Number': '0208112233',
      'Role': 'Subject Teacher',
      'Subjects': 'English Language, Social Studies',
      'Rank': 'SENIOR SUPT.1',
      'Grade': '8',
      'Date of Birth': '1990-08-23',
      'Social Security Number': 'C098765432109',
      'Date of 1st Appointment': '2015-09-01',
      'Date Posted to Current Station': '2020-09-01',
      'Last Date of Promotion': '2023-10-01',
      'Professional Qualification': 'Diploma in Basic Education',
      'Academic Qualification': 'B.A English',
      'Name of Bank': 'Ecobank Ghana',
      'Bank Account Number': '0123456789012',
      'Bank Branch': 'Accra Main',
      'NTC License Number': 'PT/2021/00456',
      'Residential Address': 'Plot 4, Madina Estate, Accra',
      'Home Town': 'Kumasi',
      'Marital Status': 'Single',
      'Religion': 'Christianity'
    },
    {
      'Staff ID': 'TEA-2024-003',
      'First Name': 'Ibrahim',
      'Last Name': 'Mohammed',
      'Email': 'ibrahim.mohammed@upnjhs.ac.pg',
      'Phone Number': '0243556677',
      'Role': 'Subject Teacher',
      'Subjects': 'Information and Communications Technology (ICT)',
      'Rank': 'SUPT1',
      'Grade': '9',
      'Date of Birth': '1993-12-05',
      'Social Security Number': 'C045678912345',
      'Date of 1st Appointment': '2018-09-01',
      'Date Posted to Current Station': '2021-01-10',
      'Last Date of Promotion': '2022-09-01',
      'Professional Qualification': 'B.Ed Computer Science',
      'Academic Qualification': 'B.Sc Computer Science',
      'Name of Bank': 'Standard Chartered',
      'Bank Account Number': '2030405060708',
      'Bank Branch': 'High Street',
      'NTC License Number': 'PT/2022/00789',
      'Residential Address': 'Flat 2B, Dansoman, Accra',
      'Home Town': 'Tamale',
      'Marital Status': 'Married',
      'Religion': 'Islam'
    }
  ];

  const worksheet = XLSX.utils.json_to_sheet(templateData);

  worksheet['!cols'] = [
    { wch: 16 }, // Staff ID
    { wch: 16 }, // First Name
    { wch: 16 }, // Last Name
    { wch: 28 }, // Email
    { wch: 16 }, // Phone Number
    { wch: 18 }, // Role
    { wch: 32 }, // Subjects
    { wch: 20 }, // Rank
    { wch: 8 },  // Grade
    { wch: 14 }, // Date of Birth
    { wch: 22 }, // SSN
    { wch: 18 }, // Date of 1st Appointment
    { wch: 20 }, // Date Posted
    { wch: 18 }, // Last Date of Promotion
    { wch: 28 }, // Professional Qualification
    { wch: 24 }, // Academic Qualification
    { wch: 18 }, // Name of Bank
    { wch: 20 }, // Bank Account Number
    { wch: 18 }, // Bank Branch
    { wch: 20 }, // NTC License Number
    { wch: 32 }, // Residential Address
    { wch: 16 }, // Home Town
    { wch: 14 }, // Marital Status
    { wch: 16 }, // Religion
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Teachers_Template');
  XLSX.writeFile(workbook, 'UP_JHS_Teacher_Import_Template.xlsx');
};

// Parse teachers from Excel / CSV file
export async function parseTeachersFromExcel(fileOrBuffer: File | ArrayBuffer): Promise<ParsedTeacherImportResult> {
  const buffer = await readFileAsArrayBuffer(fileOrBuffer);
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });

  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new Error('The uploaded spreadsheet contains no sheets.');
  }

  // Find sheet: either one named 'teacher' (case-insensitive) or the first sheet
  const targetSheetName =
    workbook.SheetNames.find(name => name.toLowerCase().includes('teacher')) ||
    workbook.SheetNames[0];

  const worksheet = workbook.Sheets[targetSheetName];
  if (!worksheet) {
    throw new Error(`Sheet "${targetSheetName}" could not be read.`);
  }

  const rawRows = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: '' });
  const teachers: ParsedTeacherRow[] = [];
  const errors: string[] = [];

  rawRows.forEach((row, index) => {
    const rowNum = index + 2; // row 1 is header
    const cleanRow: Record<string, any> = {};

    for (const [key, value] of Object.entries(row)) {
      if (value === null || value === undefined) continue;
      const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');

      if (['staffid', 'staffno', 'employeeid', 'idno', 'empno', 'staffnumber'].includes(normalizedKey)) {
        cleanRow.staffId = String(value).trim();
      } else if (['firstname', 'first', 'fname', 'givenname', 'forename'].includes(normalizedKey)) {
        cleanRow.firstName = String(value).trim();
      } else if (['lastname', 'last', 'lname', 'surname', 'familyname'].includes(normalizedKey)) {
        cleanRow.lastName = String(value).trim();
      } else if (['name', 'fullname', 'teachername'].includes(normalizedKey)) {
        cleanRow.fullName = String(value).trim();
      } else if (['email', 'emailaddress', 'teacheremail', 'mail'].includes(normalizedKey)) {
        cleanRow.email = String(value).trim();
      } else if (['phone', 'phonenumber', 'contact', 'telephone', 'mobile', 'tel'].includes(normalizedKey)) {
        cleanRow.phone = normalizePhone(value);
      } else if (['role', 'designation', 'position', 'teacherrole'].includes(normalizedKey)) {
        cleanRow.role = String(value).trim();
      } else if (['subject', 'subjects', 'courses', 'teachingsubjects', 'specialization'].includes(normalizedKey)) {
        cleanRow.subjects = normalizeTeacherSubjects(value);
      } else if (['rank', 'teacherrank', 'gesrank'].includes(normalizedKey)) {
        cleanRow.rank = normalizeTeacherRank(value);
      } else if (['grade', 'teachinggrade', 'classgrade'].includes(normalizedKey)) {
        cleanRow.grade = normalizeTeacherGrade(value);
      } else if (['dateofbirth', 'dob', 'birthdate', 'birth'].includes(normalizedKey)) {
        cleanRow.dateOfBirth = formatExcelDate(value);
      } else if (['socialsecuritynumber', 'socialsecurity', 'ssn', 'ssnit', 'ssnitnumber', 'ssnitno'].includes(normalizedKey)) {
        cleanRow.socialSecurityNumber = String(value).trim();
      } else if (['dateof1stappointment', 'dateoffirstappointment', 'firstappointmentdate', 'firstappointment', 'appointmentdate'].includes(normalizedKey)) {
        cleanRow.dateOf1stAppointment = formatExcelDate(value);
      } else if (['datepostedtocurrentstation', 'dateposted', 'stationdate', 'posteddate', 'currentstationdate'].includes(normalizedKey)) {
        cleanRow.datePostedToCurrentStation = formatExcelDate(value);
      } else if (['lastdateofpromotion', 'lastpromotiondate', 'promotiondate', 'lastpromotion'].includes(normalizedKey)) {
        cleanRow.lastDateOfPromotion = formatExcelDate(value);
      } else if (['professionalqualification', 'profqual', 'professionalqual', 'teachingqualification'].includes(normalizedKey)) {
        cleanRow.professionalQualification = String(value).trim();
      } else if (['academicqualification', 'acadqual', 'academicqual', 'highestqualification', 'qualification'].includes(normalizedKey)) {
        cleanRow.academicQualification = String(value).trim();
      } else if (['nameofbank', 'bank', 'bankname'].includes(normalizedKey)) {
        cleanRow.nameOfBank = String(value).trim();
      } else if (['bankaccountnumber', 'accountnumber', 'accountno', 'bankacc', 'accno'].includes(normalizedKey)) {
        cleanRow.bankAccountNumber = String(value).trim();
      } else if (['bankbranch', 'branch', 'bankbranchname'].includes(normalizedKey)) {
        cleanRow.bankBranch = String(value).trim();
      } else if (['ntclicensenumber', 'ntclicense', 'ntcnumber', 'licensenumber', 'ntc'].includes(normalizedKey)) {
        cleanRow.ntcLicenseNumber = String(value).trim();
      } else if (['residentialaddress', 'address', 'residence', 'homeaddress'].includes(normalizedKey)) {
        cleanRow.residentialAddress = String(value).trim();
      } else if (['hometown', 'town'].includes(normalizedKey)) {
        cleanRow.homeTown = String(value).trim();
      } else if (['maritalstatus', 'marital'].includes(normalizedKey)) {
        cleanRow.maritalStatus = normalizeMaritalStatus(value);
      } else if (['religion', 'faith', 'denomination'].includes(normalizedKey)) {
        cleanRow.religion = String(value).trim();
      } else if (['avatar', 'photo', 'picture'].includes(normalizedKey)) {
        cleanRow.avatar = String(value).trim();
      } else if (normalizedKey === 'id') {
        cleanRow.id = String(value).trim();
      }
    }

    // Split full name if provided instead of first & last
    if (cleanRow.fullName && !cleanRow.firstName) {
      const parts = cleanRow.fullName.split(/\s+/);
      cleanRow.firstName = parts[0];
      cleanRow.lastName = parts.slice(1).join(' ') || parts[0];
    }

    // Check if row is empty spacer row
    if (!cleanRow.firstName && !cleanRow.lastName && !cleanRow.staffId && !cleanRow.email) {
      return;
    }

    if (!cleanRow.firstName) {
      errors.push(`Row ${rowNum}: Skipped due to missing first name.`);
      return;
    }

    const firstName = cleanRow.firstName;
    const lastName = cleanRow.lastName || firstName;
    const staffId = cleanRow.staffId || `TEA-${new Date().getFullYear()}-${String(teachers.length + 1).padStart(3, '0')}`;
    const cleanStaff = staffId.toLowerCase().replace(/[^a-z0-9]/g, '');
    const cleanName = `${firstName.toLowerCase()}.${lastName.toLowerCase().replace(/\s+/g, '')}`;
    let avatar = cleanRow.avatar || `https://picsum.photos/seed/${encodeURIComponent(staffId)}/150/150`;
    if (avatar && avatar.startsWith('data:image/') && avatar.length > 80 * 1024) {
      avatar = `https://picsum.photos/seed/${encodeURIComponent(staffId)}/150/150`;
    }

    teachers.push({
      ...(cleanRow.id ? { id: cleanRow.id } : {}),
      firstName,
      lastName,
      email,
      phone: cleanRow.phone || '0244000000',
      role: cleanRow.role || 'Teacher',
      subjects: cleanRow.subjects || ['Mathematics'],
      avatar,
      staffId,
      socialSecurityNumber: cleanRow.socialSecurityNumber || 'C000000000000',
      dateOfBirth: cleanRow.dateOfBirth || '1990-01-01',
      dateOf1stAppointment: cleanRow.dateOf1stAppointment || '2016-09-01',
      datePostedToCurrentStation: cleanRow.datePostedToCurrentStation || '2020-01-15',
      lastDateOfPromotion: cleanRow.lastDateOfPromotion || '2022-09-01',
      grade: cleanRow.grade || '1',
      rank: cleanRow.rank || 'SUPT1',
      professionalQualification: cleanRow.professionalQualification || 'Diploma in Basic Education',
      academicQualification: cleanRow.academicQualification || 'B.Ed Basic Education',
      nameOfBank: cleanRow.nameOfBank || 'GCB Bank',
      bankAccountNumber: cleanRow.bankAccountNumber || '1000000000000',
      bankBranch: cleanRow.bankBranch || 'Main Branch',
      ntcLicenseNumber: cleanRow.ntcLicenseNumber || 'PT/2020/00000',
      residentialAddress: cleanRow.residentialAddress || 'School Quarters, Accra',
      maritalStatus: cleanRow.maritalStatus || 'Single',
      religion: cleanRow.religion || 'Christianity',
      homeTown: cleanRow.homeTown || 'Accra',
    });
  });

  return {
    teachers,
    rawCount: rawRows.length,
    errors,
    sheetName: targetSheetName,
  };
}



