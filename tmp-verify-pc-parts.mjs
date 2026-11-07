const urls = [
  "http://localhost:3000/api/pc-builder/components/cpu?limit=3",
  "http://localhost:3000/api/pc-builder/components/gpu?limit=3",
  "http://localhost:3000/api/pc-builder/components/ram?limit=3",
  "http://localhost:3000/api/pc-builder/components/ssd?limit=3",
  "http://localhost:3000/api/public/products?kind=pc_component&limit=5",
  "http://localhost:3000/api/public/debug-env",
];

for (const u of urls) {
  const res = await fetch(u);
  const j = await res.json();
  if (u.includes("debug-env")) {
    console.log("debug-env", j);
  } else if (u.includes("pc-builder")) {
    console.log(u.split("/").pop(), "total=", j.total, "sample=", (j.items || []).map((i) => i.product?.name));
  } else {
    console.log("public pc_component total=", j.total, "sample=", (j.items || []).slice(0, 3).map((i) => i.name));
  }
}
