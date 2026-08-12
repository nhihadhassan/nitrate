import { Container, PosterGridSkeleton, Skeleton } from '@/components/ui/primitives';

export default function Loading() {
  return (
    <Container size="wide" className="py-8">
      <Skeleton className="h-12 w-48" />
      <Skeleton className="mt-3 h-5 w-full max-w-xl" />
      <div className="mt-10 space-y-10">
        {[0, 1].map((rail) => (
          <div key={rail}>
            <Skeleton className="h-7 w-56" />
            <div className="mt-3">
              <PosterGridSkeleton count={8} />
            </div>
          </div>
        ))}
      </div>
    </Container>
  );
}
