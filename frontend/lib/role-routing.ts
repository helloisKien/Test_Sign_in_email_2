import type { Role } from "./auth-cookie";

export function getDefaultRouteForRole(role: Role): string {
  if (role === "Teacher" || role === "QA" || role === "Admin") {
    return "/";
  }
  return "/";
}
