// Create shop 2 for laptopthanhvo.com
const URL = "https://bmvgnhgxbkrhixydsqjh.supabase.co/rest/v1/shops";
const KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJtdmduaGd4YmtyaGl4eWRzcWpoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTQ1MTM1MCwiZXhwIjoyMDk1MDI3MzUwfQ.IihN3gAGLs2YbRAbcCkFo6nAKZPtWB13Q86i95rYHOA";

const body = {
  organization_id: "337d6225-7c41-4ebc-bbcc-e66b205e3050",
  name: "Laptop Thành Võ",
  code: "LTV",
  phone: "0987654321",
  email: "contact@laptopthanhvo.com",
  address: "456 Trần Hưng Đạo, Quận 1, TP. HCM",
  primary_domain: "laptopthanhvo.com",
  allowed_domains: ["laptopthanhvo.com", "www.laptopthanhvo.com"],
  is_active: true,
};

const res = await fetch(URL, {
  method: "POST",
  headers: {
    "apikey": KEY,
    "Authorization": `Bearer ${KEY}`,
    "Content-Type": "application/json",
    "Prefer": "return=representation",
  },
  body: JSON.stringify(body),
});
const data = await res.json();
console.log("Status:", res.status);
console.log("Response:", JSON.stringify(data, null, 2));
