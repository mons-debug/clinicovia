export default async function CampaignAnalyticsPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-text-primary">Campaign Analytics: {id}</h1>
      <p className="text-text-secondary">Coming soon...</p>
    </div>
  );
}
