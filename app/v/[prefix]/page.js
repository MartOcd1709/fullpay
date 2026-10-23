import VerifyResult from "@/components/public/VerifyResult";

export const metadata = { title: "Verify a record", robots: { index: false } };

// Short verify link (K24): the first 16 hex of the record hash, small enough for a scannable printed QR.
export default async function ShortVerifyPage({ params }) {
  const { prefix } = await params;
  return <VerifyResult code={prefix} />;
}
