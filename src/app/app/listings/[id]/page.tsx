import { ListingHub } from "@/components/ListingHub";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function ListingHubPage({ params }: PageProps) {
  const { id } = await params;
  return <ListingHub listingId={id} />;
}
