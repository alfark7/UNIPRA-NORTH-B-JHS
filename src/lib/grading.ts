
'use client';

import type { SubjectScore } from './types';

export const getGrade = (totalScore: number): string | null => {
    if (totalScore >= 90) return '1';
    if (totalScore >= 80) return '2';
    if (totalScore >= 70) return '3';
    if (totalScore >= 60) return '4';
    if (totalScore >= 55) return '5';
    if (totalScore >= 50) return '6';
    if (totalScore >= 45) return '7';
    if (totalScore >= 40) return '8';
    if (totalScore < 40 && totalScore >= 0) return '9';
    return null;
};

export const getGradeRemark = (grade: string | undefined | null) => {
    if (!grade) return '';
    switch (grade) {
        case '1': return 'Highest';
        case '2': return 'Higher';
        case '3': return 'High';
        case '4': return 'Above Average';
        case '5': return 'Average';
        case '6': return 'Below Average';
        case '7': return 'Low';
        case '8': return 'Lower';
        case '9': return 'Lowest';
        default: return '';
    }
};

export const calculateScores = (score: Partial<SubjectScore>, scoreSettings: any) => {
    const test1 = score.test1 || 0;
    const test2 = score.test2 || 0;
    const groupWork = score.groupWork || 0;
    const project = score.project || 0;
    const classExercises = score.classExercises || 0;
    const homeWork = score.homeWork || 0;
    const exam = score.exam || 0;

    const totalContinuousAssessment = test1 + test2 + groupWork + project + classExercises + homeWork;
    const maxContinuousAssessment = scoreSettings.test1 + scoreSettings.test2 + scoreSettings.groupWork + scoreSettings.project + scoreSettings.classExercises + scoreSettings.homeWork;

    const weightedClassScore = maxContinuousAssessment > 0 ? (totalContinuousAssessment / maxContinuousAssessment) * 50 : 0;
    const weightedExamScore = scoreSettings.exam > 0 ? (exam / scoreSettings.exam) * 50 : 0;

    const total = weightedClassScore + weightedExamScore;
    const grade = getGrade(Math.round(total));
    
    return {
        classScore: Math.round(weightedClassScore),
        examScore: Math.round(weightedExamScore),
        total: Math.round(total),
        grade,
        remark: getGradeRemark(grade)
    };
};
