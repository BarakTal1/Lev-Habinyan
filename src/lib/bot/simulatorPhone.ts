/** A new phone number for the simulator, in the 05299 range that tests and developers share. It is a helper so a page can call it without rendering impurely. */
export function newSimulatorPhone(): string {
  return `05299${String(Math.floor(10000 + Math.random() * 89999))}`;
}
