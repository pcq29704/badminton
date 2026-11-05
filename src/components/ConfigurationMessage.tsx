import { Card } from "@/components/ui";

export default function ConfigurationMessage() {
  return (
    <Card title="Not configured yet" note="Development Supabase is not configured yet." tools={null} footer={null}>
      <p className="cb-note">Add the development values to <code>.env.local</code> when available, then restart the dev server.</p>
    </Card>
  );
}
