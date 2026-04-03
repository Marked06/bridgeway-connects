export default function EnvTest() {
  return (
    <main style={{ padding: 24 }}>
      <h1>Env Test</h1>
      <p>SUPABASE_URL: {process.env.NEXT_PUBLIC_SUPABASE_URL ? "set" : "not set"}</p>
      <p>ANON_KEY: {process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "set" : "not set"}</p>
    </main>
  );
}
