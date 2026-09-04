import { Container, PosterGridSkeleton, Skeleton } from '@/components/ui/primitives';

export default function Loading() {
  return (
    <Container size="wide" className="py-6 sm:py-8">
      <Skeleton className="h-40 w-full rounded-lg" />
      <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <div>
          <Skeleton className="h-9 w-64" />
          <div className="mt-5 space-y-5">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="flex gap-3 border-b border-line pb-5">
                <Skeleton className="aspect-[2/3] w-20 shrink-0" />
                <div className="flex-1 space-y-2 pt-1">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </div>
        <aside>
          <Skeleton className="h-6 w-32" />
          <div className="mt-3">
            <PosterGridSkeleton count={6} />
          </div>
        </aside>
      </div>
    </Container>
  );
}
