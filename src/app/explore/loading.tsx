import { Container, Skeleton } from '@/components/ui/primitives';

function RailSkeleton() {
  return (
    <div>
      <Skeleton className="h-6 w-56" />
      <div className="mt-3 flex gap-3 overflow-hidden">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="aspect-[2/3] w-28 shrink-0 rounded-sm sm:w-32" />
        ))}
      </div>
    </div>
  );
}

export default function Loading() {
  return (
    <Container size="wide" className="py-8 pb-20">
      <Skeleton className="h-12 w-48" />
      <Skeleton className="mt-3 h-5 w-full max-w-xl" />
      <div className="mt-10 space-y-14">
        <div className="space-y-8">
          <Skeleton className="h-3 w-24" />
          {[0, 1, 2].map((rail) => (
            <RailSkeleton key={rail} />
          ))}
        </div>
        <div className="space-y-8">
          <Skeleton className="h-3 w-40" />
          {[0, 1].map((rail) => (
            <RailSkeleton key={rail} />
          ))}
        </div>
      </div>
    </Container>
  );
}
