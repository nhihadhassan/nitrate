import { Container, PosterGridSkeleton, Skeleton } from '@/components/ui/primitives';

export default function Loading() {
  return (
    <Container size="wide" className="py-8">
      <Skeleton className="h-9 w-48" />
      <div className="mt-6">
        <PosterGridSkeleton count={16} />
      </div>
    </Container>
  );
}
