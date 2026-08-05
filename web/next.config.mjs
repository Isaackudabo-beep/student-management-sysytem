/** @type {import('next').NextConfig} */
const RENDER_API = "https://student-management-sysytem-xx6i.onrender.com";

const nextConfig = {
  reactStrictMode: true,
  // Ensures Vercel production builds call the Render API even if the
  // dashboard env var is missing. Local `.env.local` still wins when set.
  env: {
    NEXT_PUBLIC_API_URL:
      process.env.NEXT_PUBLIC_API_URL ??
      (process.env.VERCEL || process.env.NODE_ENV === "production"
        ? RENDER_API
        : "http://localhost:4000"),
  },
};

export default nextConfig;
