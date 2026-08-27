export function shouldShowHeaderInlineAuth(pathname: string): boolean {
  return pathname !== "/join" && pathname !== "/join/";
}
