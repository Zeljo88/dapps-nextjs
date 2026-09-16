This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Backend configuration

All application backend requests are server-side. Configure:

- `API_URL` — the backend origin. `npm run build` requires it. Release builds must use an HTTPS URL, for example `https://api.example.com`; loopback HTTP is accepted only for local build verification.
- When `API_URL` is unset in local development, the app uses `http://127.0.0.1:8000`.

Do not expose the backend through a `NEXT_PUBLIC_*` variable. Set `API_URL` in the deployment platform for Production, Preview, and Development as appropriate.

The build intentionally fails before Next.js compilation when `API_URL` is missing, malformed, or uses insecure HTTP for a non-loopback host. This prevents deployment of prerendered pages or a sitemap built from absent/bogus data. Backend request failures also fail prerendering instead of producing indexable empty pages.

## Getting Started

```bash
API_URL=http://127.0.0.1:8000 npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser. With a running production build, `npm run test:seo` checks status codes, canonical and robots metadata, title composition, sitemap coverage, the removed debug route, and the www redirect.

Run `npm run test:config` to verify the release-time `API_URL` policy.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
