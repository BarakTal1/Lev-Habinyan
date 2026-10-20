/** The password form on the sign-in page is for local development only. It is never on when running on Vercel. */
export function devLoginEnabled(): boolean {
  return process.env.NEXT_PUBLIC_DEV_LOGIN === "1" && !process.env.VERCEL;
}
