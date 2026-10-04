export function staffReturnPath(value: string): string {
  return /^\/check-in\/[a-f0-9]{32}$/.test(value) ? value : "/staff";
}
