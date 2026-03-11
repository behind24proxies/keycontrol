/**
 * Quick diagnostic: replicate exactly what the gateway sends to Google Maps.
 * Run inside the Docker container:  node test-google-maps.mjs
 */
import axios from "axios";
import https from "https";

const axiosConfig = {
  method: "GET",
  url: "https://maps.googleapis.com/maps/api/geocode/json",
  headers: {
    "x-real-ip": "39.63.167.117",
    "x-forwarded-for": "39.63.167.117",
    "x-forwarded-proto": "http",
    "user-agent": "PostmanRuntime/7.49.1",
    "accept": "*/*",
    "content-type": "application/json",
  },
  params: {
    key: "AIzaSyDkMpPIPIr5ipkGcltBjjdqF6AoLBzwIBY",
    address: "London",
  },
  data: null,
  validateStatus: () => true,
  responseType: "arraybuffer",
  maxContentLength: Infinity,
  maxBodyLength: Infinity,
};

console.log("\n=== Test 1: Exact same axios config as gateway ===");
try {
  const res1 = await axios(axiosConfig);
  console.log("Status:", res1.status);
  console.log("Response:", Buffer.from(res1.data).toString("utf-8").substring(0, 300));
} catch (e) {
  console.error("Error:", e.message);
}

console.log("\n=== Test 2: Minimal axios GET (no extra headers) ===");
try {
  const res2 = await axios.get(
    "https://maps.googleapis.com/maps/api/geocode/json",
    { params: { key: "AIzaSyDkMpPIPIr5ipkGcltBjjdqF6AoLBzwIBY", address: "London" } },
  );
  console.log("Status:", res2.status);
  console.log("Response:", JSON.stringify(res2.data).substring(0, 300));
} catch (e) {
  console.error("Error:", e.message);
}

console.log("\n=== Test 3: Native Node.js https (bypass axios) ===");
const nativeResult = await new Promise((resolve, reject) => {
  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json?key=AIzaSyDkMpPIPIr5ipkGcltBjjdqF6AoLBzwIBY&address=London");
  https.get(url, (res) => {
    let data = "";
    res.on("data", (chunk) => (data += chunk));
    res.on("end", () => resolve({ status: res.statusCode, data: data.substring(0, 300) }));
  }).on("error", reject);
});
console.log("Status:", nativeResult.status);
console.log("Response:", nativeResult.data);

console.log("\n=== Axios version ===");
console.log(axios.VERSION || "unknown");
