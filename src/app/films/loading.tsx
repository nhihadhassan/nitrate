import { Container, PosterGridSkeleton, Skeleton } from '@/components/ui/primitives';

export default function Loading() {
  return (
    <Container size="wide" className="py-8">
      <Skeleton className="h-10 w-36" />
      <div className="mt-6 space-y-3">
        <div className="flex gap-1.5 overflow-hidden">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-10 w-28 shrink-0" />
          ))}
        </div>
        <div className="flex gap-1.5 overflow-hidden">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-10 w-20 shrink-0" />
          ))}
        </div>
        <div className="flex gap-1.5 overflow-hidden">
          {Array.from({ length: 7 }).map((_, index) => (
            <Skeleton key={index} className="h-10 w-24 shrink-0" />
          ))}
        </div>
      </div>
      <div className="mt-6">
        <PosterGridSkeleton count={16} />
      </div>
    </Container>
  );
}
