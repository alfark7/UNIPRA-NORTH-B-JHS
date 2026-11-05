import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import {
  BeceCandidate,
  BeceAnalysisResult,
  calculateBestSixTotal,
  BECE_SUBJECTS,
} from './bece-data';

export function exportBeceToExcel(candidates: BeceCandidate[], academicYear: string) {
  const data = candidates.map((c, index) => ({
    'S/N': c.sn || index + 1,
    'NAME OF CANDIDATE': c.name,
    'INDEX NUMBER': c.indexNumber,
    'ENG': c.eng,
    'MATHS': c.maths,
    'SCI': c.sci,
    'S. STDS': c.social,
    'RME': c.rme,
    'CAD': c.cad,
    'C. TECH': c.careerTech,
    'COMP': c.computing,
    'FREN': c.french,
    'FANTE': c.fante,
    'BEST SIX (6) TOTAL': c.bestSixTotal,
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'BECE Results');
  
  const cleanYear = academicYear.replace(/[^a-zA-Z0-9]/g, '_');
  XLSX.writeFile(workbook, `UNIPRA_NORTH_JHS_BECE_RESULTS_${cleanYear}.xlsx`);
}

export function exportBeceAnalysisToExcel(analysis: BeceAnalysisResult, academicYear: string) {
  const subjectRows = analysis.subjectAnalysis.map((s) => ({
    'No.': s.no,
    'Subject': s.subjectName,
    'Code': s.code,
    'Pass (Grades 1-6)': s.passCount,
    'Pass %': `${s.passPercent}%`,
    'Fail (Grades 7-9)': s.failCount,
    'Fail %': `${s.failPercent}%`,
  }));

  const summaryRows = [
    { 'Metric': 'Total Candidates', 'Value': analysis.totalCandidates },
    { 'Metric': 'Total Subject Entries', 'Value': analysis.totalSubjectEntries },
    { 'Metric': 'Total Passes (Grades 1-6)', 'Value': analysis.totalPasses },
    { 'Metric': 'Total Failures (Grades 7-9)', 'Value': analysis.totalFailures },
    { 'Metric': 'Overall Subject Pass Rate', 'Value': `${analysis.overallPassPercent}%` },
    { 'Metric': 'Overall Subject Fail Rate', 'Value': `${analysis.overallFailPercent}%` },
  ];

  const workbook = XLSX.utils.book_new();
  const ws1 = XLSX.utils.json_to_sheet(subjectRows);
  const ws2 = XLSX.utils.json_to_sheet(summaryRows);

  XLSX.utils.book_append_sheet(workbook, ws1, 'Subject Pass-Fail Analysis');
  XLSX.utils.book_append_sheet(workbook, ws2, 'Key Findings Summary');

  const cleanYear = academicYear.replace(/[^a-zA-Z0-9]/g, '_');
  XLSX.writeFile(workbook, `UNIPRA_NORTH_JHS_BECE_ANALYSIS_${cleanYear}.xlsx`);
}

export function downloadBeceTemplateExcel() {
  const sampleData = [
    {
      'S/N': 1,
      'NAME OF CANDIDATE': 'ABBAM GODFRED',
      'INDEX NUMBER': '0302054001',
      'ENG': 7,
      'MATHS': 7,
      'SCI': 5,
      'S. STDS': 4,
      'RME': 5,
      'CAD': 5,
      'C. TECH': 5,
      'COMP': 7,
      'FREN': 7,
      'FANTE': 6,
    },
    {
      'S/N': 2,
      'NAME OF CANDIDATE': 'AKUAMOAH ELORM PRAISE',
      'INDEX NUMBER': '0302054018',
      'ENG': 1,
      'MATHS': 3,
      'SCI': 3,
      'S. STDS': 2,
      'RME': 2,
      'CAD': 2,
      'C. TECH': 4,
      'COMP': 5,
      'FREN': 6,
      'FANTE': 2,
    },
  ];

  const worksheet = XLSX.utils.json_to_sheet(sampleData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'BECE Template');
  XLSX.writeFile(workbook, 'BECE_Academic_Performance_Template.xlsx');
}

export async function parseBeceFile(file: File, academicYear: string): Promise<BeceCandidate[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  const jsonData = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet);

  const cleanNumber = (val: any, fallback = 9): number => {
    if (val === undefined || val === null || val === '') return fallback;
    const n = Number(String(val).trim());
    if (isNaN(n) || n < 1 || n > 9) return fallback;
    return n;
  };

  const getField = (row: Record<string, any>, candidates: string[]): any => {
    for (const key of Object.keys(row)) {
      const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, '');
      for (const cand of candidates) {
        if (normalized === cand.toLowerCase().replace(/[^a-z0-9]/g, '')) {
          return row[key];
        }
      }
    }
    return undefined;
  };

  const parsed: BeceCandidate[] = jsonData.map((row, index) => {
    const snVal = getField(row, ['s/n', 'sn', 'no', 'number']) || index + 1;
    const nameVal = getField(row, ['name of candidate', 'name', 'student name', 'candidate']) || `Candidate ${index + 1}`;
    const indexNumberVal = getField(row, ['index number', 'index no', 'index', 'id']) || `0302054${String(index + 1).padStart(3, '0')}`;

    const eng = cleanNumber(getField(row, ['eng', 'english', 'english language']));
    const maths = cleanNumber(getField(row, ['maths', 'mathematics', 'math']));
    const sci = cleanNumber(getField(row, ['sci', 'science', 'integrated science']));
    const social = cleanNumber(getField(row, ['s. stds', 'social studies', 'social', 'sstds', 'sst']));
    const rme = cleanNumber(getField(row, ['rme', 'religious and moral education', 'rel']));
    const cad = cleanNumber(getField(row, ['cad', 'creative arts', 'creative arts and design', 'ca']));
    const careerTech = cleanNumber(getField(row, ['c. tech', 'career tech', 'career technology', 'ctech', 'technical']));
    const computing = cleanNumber(getField(row, ['comp', 'computing', 'ict']));
    const french = cleanNumber(getField(row, ['fren', 'french']));
    const fante = cleanNumber(getField(row, ['fante', 'ghanaian language', 'twi', 'language']));

    const bestSixTotal = calculateBestSixTotal({
      eng,
      maths,
      sci,
      social,
      rme,
      cad,
      careerTech,
      computing,
      french,
      fante,
    });

    return {
      id: `bece_${academicYear.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}_${index}`,
      sn: Number(snVal) || index + 1,
      name: String(nameVal).trim().toUpperCase(),
      indexNumber: String(indexNumberVal).trim(),
      academicYear,
      eng,
      maths,
      sci,
      social,
      rme,
      cad,
      careerTech,
      computing,
      french,
      fante,
      bestSixTotal,
      createdAt: new Date().toISOString(),
    };
  });

  return parsed;
}

export function exportBeceToPdf(
  candidates: BeceCandidate[],
  academicYear: string,
  analysis?: BeceAnalysisResult
) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  // Title Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('UNIPRA NORTH JHS', 148, 14, { align: 'center' });

  doc.setFontSize(12);
  doc.text(`${academicYear} ACADEMIC YEAR CANDIDATES`, 148, 20, { align: 'center' });

  doc.setFontSize(11);
  doc.text('BECE RESULT & PERFORMANCE SHEET', 148, 26, { align: 'center' });

  doc.setLineWidth(0.4);
  doc.line(14, 28, 283, 28);

  // Table Data
  const tableHeaders = [
    'S/N',
    'NAME OF CANDIDATE',
    'INDEX NO.',
    'ENG',
    'MATH',
    'SCI',
    'S.ST',
    'RME',
    'CAD',
    'C.TC',
    'CMP',
    'FRN',
    'FNT',
    'BEST 6',
  ];

  const tableBody = candidates.map((c, i) => [
    c.sn || i + 1,
    c.name,
    c.indexNumber,
    c.eng,
    c.maths,
    c.sci,
    c.social,
    c.rme,
    c.cad,
    c.careerTech,
    c.computing,
    c.french,
    c.fante,
    c.bestSixTotal,
  ]);

  (doc as any).autoTable({
    head: [tableHeaders],
    body: tableBody,
    startY: 32,
    theme: 'grid',
    styles: {
      fontSize: 7.5,
      cellPadding: 1.5,
      halign: 'center',
    },
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center',
    },
    columnStyles: {
      0: { cellWidth: 10 },
      1: { cellWidth: 62, halign: 'left' },
      2: { cellWidth: 26 },
      3: { cellWidth: 12 },
      4: { cellWidth: 12 },
      5: { cellWidth: 12 },
      6: { cellWidth: 12 },
      7: { cellWidth: 12 },
      8: { cellWidth: 12 },
      9: { cellWidth: 12 },
      10: { cellWidth: 12 },
      11: { cellWidth: 12 },
      12: { cellWidth: 12 },
      13: { cellWidth: 18, fontStyle: 'bold', fillColor: [241, 245, 249] },
    },
  });

  // If analysis is provided, append analysis summary page
  if (analysis) {
    doc.addPage('landscape');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.text('UNIPRA NORTH JHS', 148, 14, { align: 'center' });
    doc.setFontSize(12);
    doc.text(`SUBJECT PASS AND FAIL ANALYSIS — ${academicYear}`, 148, 20, { align: 'center' });
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('Grades 1–6 = PASS  |  Grades 7–9 = FAIL', 148, 25, { align: 'center' });
    doc.line(14, 27, 283, 27);

    const analysisHeaders = ['No.', 'Subject', 'Pass Count', 'Pass %', 'Fail Count', 'Fail %'];
    const analysisBody = analysis.subjectAnalysis.map((s) => [
      s.no,
      s.subjectName,
      s.passCount,
      `${s.passPercent}%`,
      s.failCount,
      `${s.failPercent}%`,
    ]);

    (doc as any).autoTable({
      head: [analysisHeaders],
      body: analysisBody,
      startY: 32,
      theme: 'striped',
      headStyles: {
        fillColor: [30, 41, 59],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
      },
      styles: {
        fontSize: 9,
        cellPadding: 2,
        halign: 'center',
      },
      columnStyles: {
        1: { halign: 'left', fontStyle: 'bold' },
      },
    });

    const finalY = (doc as any).lastAutoTable.finalY + 8;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Key Findings & Overall Statistics:', 14, finalY);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`• Total Candidates: ${analysis.totalCandidates}`, 16, finalY + 6);
    doc.text(`• Total Subject Entries: ${analysis.totalSubjectEntries.toLocaleString()}`, 16, finalY + 11);
    doc.text(`• Total Passes (Grades 1–6): ${analysis.totalPasses.toLocaleString()} (${analysis.overallPassPercent}%)`, 16, finalY + 16);
    doc.text(`• Total Failures (Grades 7–9): ${analysis.totalFailures.toLocaleString()} (${analysis.overallFailPercent}%)`, 16, finalY + 21);
    doc.setFont('helvetica', 'bold');
    doc.text(`• Overall Subject Pass Rate for UNIPRA NORTH JHS: ${analysis.overallPassPercent}%`, 16, finalY + 27);
  }

  const cleanYear = academicYear.replace(/[^a-zA-Z0-9]/g, '_');
  doc.save(`UNIPRA_NORTH_JHS_BECE_RESULTS_${cleanYear}.pdf`);
}
