export default async function ConversationPage(props: { params: Promise<{ conversationId: string }> }) {
  const { conversationId } = await props.params;
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-text-primary">Conversation: {conversationId}</h1>
      <p className="text-text-secondary">Coming soon...</p>
    </div>
  );
}
