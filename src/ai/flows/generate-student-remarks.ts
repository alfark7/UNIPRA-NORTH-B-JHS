'use server';

/**
 * @fileOverview Generates student remarks for report cards based on performance and behavior.
 *
 * - generateStudentRemarks - A function that generates student remarks.
 * - GenerateStudentRemarksInput - The input type for the generateStudentRemarks function.
 * - GenerateStudentRemarksOutput - The return type for the generateStudentRemarks function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateStudentRemarksInputSchema = z.object({
  studentName: z.string().describe('The name of the student.'),
  performanceSummary: z.string().describe('A summary of the student\'s academic performance.'),
  behaviorSummary: z.string().describe('A summary of the student\'s behavior.'),
});
export type GenerateStudentRemarksInput = z.infer<typeof GenerateStudentRemarksInputSchema>;

const GenerateStudentRemarksOutputSchema = z.object({
  teacherRemark: z.string().describe('A suggested remark for the teacher to include on the report card.'),
  headTeacherRemark: z.string().describe('A suggested remark for the head teacher to include on the report card.'),
});
export type GenerateStudentRemarksOutput = z.infer<typeof GenerateStudentRemarksOutputSchema>;

export async function generateStudentRemarks(input: GenerateStudentRemarksInput): Promise<GenerateStudentRemarksOutput> {
  return generateStudentRemarksFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateStudentRemarksPrompt',
  input: {schema: GenerateStudentRemarksInputSchema},
  output: {schema: GenerateStudentRemarksOutputSchema},
  prompt: `You are an AI assistant designed to help teachers quickly generate personalized remarks for student report cards.

  Based on the student's performance and behavior, provide a relevant and context-aware teacher remark and head teacher remark.

  Student Name: {{{studentName}}}
  Performance Summary: {{{performanceSummary}}}
  Behavior Summary: {{{behaviorSummary}}}

  Teacher Remark: A personalized remark for the teacher.
  Head Teacher Remark: A personalized remark for the head teacher.
  `,
});

const generateStudentRemarksFlow = ai.defineFlow(
  {
    name: 'generateStudentRemarksFlow',
    inputSchema: GenerateStudentRemarksInputSchema,
    outputSchema: GenerateStudentRemarksOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
