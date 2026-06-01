import fs from "node:fs";

const url = process.argv[2];

if (!url || !/^https?:\/\/[^/]+/.test(url)) {
  console.error("Usage: npm run set:api -- https://your-public-url");
  process.exit(1);
}

const cleanUrl = url.replace(/\/$/, "");
const config = `if (!["127.0.0.1", "localhost"].includes(window.location.hostname)) {
  window.GYAN_API_BASE_URL = ${JSON.stringify(cleanUrl)};
}
`;

fs.writeFileSync(new URL("../public/config.js", import.meta.url), config);
console.log(`Gyan Chakra API URL set to ${cleanUrl}`);
