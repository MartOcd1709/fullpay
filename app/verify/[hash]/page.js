import VerifyResult from "@/components/public/VerifyResult";

export const metadata = { title: "Verify a record", robots: { index: false } };

export default async function VerifyPage({ params }) {
  const { hash } = await params;
  return <VerifyResult code={hash} />;
}
