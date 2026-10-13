export default function ConfigurationMessage() {
  return (
    <div className="card center">
      <p>Development Supabase is not configured yet.</p>
      <p className="hint">Add the development values to <code>.env.local</code> when available, then restart the dev server.</p>
    </div>
  );
}
