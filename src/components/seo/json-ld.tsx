type JsonLdValue = Record<string, unknown> | Array<Record<string, unknown>>;

/**
 * Renders structured data without allowing a user-authored string to close the
 * script tag. Keep schema objects close to the page whose visible content they
 * describe so markup and UI cannot quietly drift apart.
 */
export function JsonLd({ data }: { data: JsonLdValue }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}
    />
  );
}
