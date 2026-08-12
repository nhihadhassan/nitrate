import { Container, Skeleton } from '@/components/ui/primitives';

export default function Loading() {
  return (
    <Container size="wide" className="py-8">
      <Skeleton className="h-9 w-40" />
      <Skeleton className="mt-4 h-11 w-full max-w-xl" />
      <div className="mt-10 space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    </Container>
  );
}
