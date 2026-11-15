import { notFound } from 'next/navigation';
import { parseCourseOfferingIdentifier } from '@/features/roadmap';

export default async function CourseOfferingLayout({
  children,
  params,
}: LayoutProps<'/courses/[courseCode]/[year]/[semester]'>) {
  if (!parseCourseOfferingIdentifier(await params)) notFound();
  return children;
}
