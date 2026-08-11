import { Container } from '@/components/ui/primitives';

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <Container size="narrow" className="py-12 pb-24">
      <article className="space-y-6 [&_h2]:mt-8 [&_h2]:text-2xl [&_h3]:mt-6 [&_h3]:text-lg [&_li]:text-[0.9375rem] [&_li]:leading-relaxed [&_li]:text-muted [&_p]:text-[0.9375rem] [&_p]:leading-relaxed [&_p]:text-muted [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5">
        {children}
      </article>
    </Container>
  );
}
