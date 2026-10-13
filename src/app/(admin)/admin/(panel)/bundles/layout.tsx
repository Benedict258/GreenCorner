// The quote tools built before the redesign keep their own styles (src/app/(admin)/legacy.css).
export default function LegacyLayout({ children }: { children: React.ReactNode }) {
  return <div className="legacy legacy-wrap">{children}</div>;
}
