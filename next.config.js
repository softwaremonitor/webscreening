/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["rss-parser", "cheerio", "robots-parser", "fast-xml-parser"],
};

module.exports = nextConfig;
