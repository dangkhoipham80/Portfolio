import type { NextConfig } from "next";

import { BLOB_HOSTNAME } from "./lib/blob";

const nextConfig: NextConfig = {
  images: {
    /*
     * One host: this project's Blob store. See lib/blob.ts for why it is not
     * the `**.public.blob.vercel-storage.com` wildcard, and for the matching
     * guard the components use before handing a URL to next/image.
     */
    remotePatterns: [
      {
        protocol: "https",
        hostname: BLOB_HOSTNAME,
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
