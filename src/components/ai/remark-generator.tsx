

'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { generateStudentRemarks, type GenerateStudentRemarksOutput } from '@/ai/flows/generate-student-remarks';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';

const formSchema = z.object({
  performanceSummary: z.string().min(10, 'Please provide a more detailed performance summary.'),
  behaviorSummary: z.string().min(10, 'Please provide a more detailed behavior summary.'),
});

type RemarkFormValues = z.infer<typeof formSchema>;

interface RemarkGeneratorProps {
  studentName: string;
  performanceSummary?: string;
  behaviorSummary?: string;
  onRemarksGenerated?: (remarks: GenerateStudentRemarksOutput) => void;
}

export function RemarkGenerator({ studentName, performanceSummary, behaviorSummary, onRemarksGenerated }: RemarkGeneratorProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [generatedRemarks, setGeneratedRemarks] = useState<GenerateStudentRemarksOutput | null>(null);
  const { toast } = useToast();

  const form = useForm<RemarkFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      performanceSummary: performanceSummary || '',
      behaviorSummary: behaviorSummary || '',
    },
  });

  useEffect(() => {
    if (performanceSummary) {
        form.setValue('performanceSummary', performanceSummary);
    }
    if (behaviorSummary) {
        form.setValue('behaviorSummary', behaviorSummary);
    }
  }, [performanceSummary, behaviorSummary, form]);

  async function onSubmit(values: RemarkFormValues) {
    setIsLoading(true);
    setGeneratedRemarks(null);
    try {
      const remarks = await generateStudentRemarks({
        studentName,
        ...values,
      });
      setGeneratedRemarks(remarks);
      if (onRemarksGenerated) {
        onRemarksGenerated(remarks);
      }
    } catch (error) {
      console.error('AI Remark Generation Failed:', error);
      toast({
        variant: 'destructive',
        title: 'Error Generating Remarks',
        description: 'There was a problem connecting to the AI service. Please try again.',
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>AI Remark Generator</CardTitle>
          <CardDescription>
            The student's performance and attendance are pre-filled. Add more details to generate remarks.
          </CardDescription>
        </CardHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="performanceSummary"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Academic Performance</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder={`e.g., '${studentName} excels in Mathematics but struggles with English comprehension...'`}
                        {...field}
                        rows={4}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="behaviorSummary"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Behavior & Attitude</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder={`e.g., 'Is a respectful and active participant in class discussions...'`}
                        {...field}
                        rows={4}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
            <CardFooter>
              <Button type="submit" disabled={isLoading}>
                <Wand2 className="mr-2 h-4 w-4" />
                {isLoading ? 'Generating...' : 'Generate Remarks'}
              </Button>
            </CardFooter>
          </form>
        </Form>
      </Card>
      
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Teacher's Remark</CardTitle>
          </CardHeader>
          <CardContent className="min-h-[100px] text-sm text-muted-foreground">
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            ) : (
              generatedRemarks?.teacherRemark || 'AI-generated teacher remark will appear here.'
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Head Teacher's Remark</CardTitle>
          </CardHeader>
          <CardContent className="min-h-[100px] text-sm text-muted-foreground">
             {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            ) : (
              generatedRemarks?.headTeacherRemark || 'AI-generated head teacher remark will appear here.'
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
