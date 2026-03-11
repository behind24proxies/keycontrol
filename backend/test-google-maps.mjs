/**
 * Use httpbin.org to see what axios ACTUALLY sends over the wire.
 * This makes ZERO calls to Google Maps.
 * Run inside Docker:  node test-google-maps.mjs
 */
import axios from "axios";

async function inspect(label, config) {
  try {
    const res = await axios({
      url: "https://httpbin.org/get",
      method: "GET",
      validateStatus: () => true,
      ...config,
    });
    const data = typeof res.data === "string" 
      ? JSON.parse(res.data) 
      : Buffer.isBuffer(res.data) 
        ? JSON.parse(Buffer.from(res.data).toString("utf-8"))
        : res.data;
    console.log(`\n=== ${label} ===`);
    console.log("Headers received by server:", JSON.stringify(data.headers, null, 2));
    console.log("URL received:", data.url);
  } catch (e) {
    console.log(`\n=== ${label} === ERROR: ${e.message}`);
  }
}

// Working config (minimal, like Test 2)
await inspect("WORKING: minimal axios GET", {
  params: { key: "test123", address: "London" },
});

// Failing config (exact same as gateway)
await inspect("FAILING: exact gateway config", {
  params: { key: "test123", address: "London" },
  headers: {
    "x-real-ip": "39.63.167.117",
    "x-forwarded-for": "39.63.167.117",
    "x-forwarded-proto": "http",
    "user-agent": "PostmanRuntime/7.49.1",
    "accept": "*/*",
    "content-type": "application/json",
  },
  data: null,
  responseType: "arraybuffer",
  maxContentLength: Infinity,
  maxBodyLength: Infinity,
});

console.log("\n=== Axios version:", axios.VERSION || "unknown", "===");
