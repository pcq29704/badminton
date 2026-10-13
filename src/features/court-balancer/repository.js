export class Oops extends Error {}

// Supabase calls return {data, error}. This turns an error into a thrown exception.
export async function query(promise) {
  const { data, error } = await promise;
  if (error) {
    // P0001 = a rule in the database said no (e.g. "too late to correct") — not a connection problem
    if (error.code === "P0001") throw new Oops(error.message);
    throw new Error(error.message || String(error));
  }
  return data;
}

