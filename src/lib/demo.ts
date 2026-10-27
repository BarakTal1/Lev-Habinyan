/** The shared demo sign-in is on only when both variables are set. See src/app/demo/route.ts. */
export function demoModeEnabled(): boolean {
  return Boolean(process.env.DEMO_EMAIL && process.env.DEMO_PASSWORD);
}
