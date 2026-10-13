// Debug: verify shop data
const URL = "https://bmvgnhgxbkrhixydsqjh.supabase.co/rest/v1/shops";
const KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJtdmduaGd4YmtyaGl4eWRzcWpoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTQ1MTM1MCwiZXhwIjoyMDk1MDI3MzUwfQ.IihN3gAGLs2YbRAbcCkFo6nAKZPtWB13Q86i95rYHOA";

const res = await fetch(`${URL}?select=id,name,primary_domain,allowed_domains`, {
  headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
});
const data = await res.json();
console.log("All shops:");
console.log(JSON.stringify(data, null, 2));

// Test the exact query the middleware would do
for (const hostKey of ["laptopthanhvo.com", "laplapcantho.store"]) {
  console.log(`\n--- Query for host: ${hostKey} ---`);
  const safeKey = hostKey.replace(/[,"\\]/g, "");
  const url = `${URL}?select=id,name,primary_domain,allowed_domains&or=(primary_domain.eq.${safeKey},allowed_domains.cs.%7B${safeKey}%7D)`;
  console.log("URL:", url);
  const r2 = await fetch(url, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } });
  const d2 = await r2.json();
  console.log("Status:", r2.status);
  console.log("Result:", JSON.stringify(d2, null, 2));
}
