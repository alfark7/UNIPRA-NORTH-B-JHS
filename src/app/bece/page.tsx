import { BecePerformanceView } from '@/components/bece/bece-performance-view';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'BECE Academic Performance | UP JHS Hub',
  description: 'Basic Education Certificate Examination (BECE) results, candidate grades, pass/fail analysis, and statistical reporting for UNIPRA NORTH JHS.',
};

export default function BecePage() {
  return <BecePerformanceView />;
}
