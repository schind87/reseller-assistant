import { redirect } from "next/navigation";

type ReviewPageProps = {
  params: Promise<{ id: string }>;
};

/** Draft editing lives on the listing hub now. */
export default async function ReviewPage({ params }: ReviewPageProps) {
  const { id } = await params;
  redirect(`/app/listings/${id}`);
}
