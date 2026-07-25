import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(process.cwd(), "../..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("browser session source contracts", () => {
  for (const app of ["partner-admin", "platform-admin", "kvartal-admin"]) {
    it(`${app} uses memory popup, session-only redirect, sign-out and CSRF`, () => {
      const source = read(`apps/${app}/src/app/login/LoginClient.tsx`);
      expect(source).toContain("inMemoryPersistence"); expect(source).toContain("browserSessionPersistence");
      expect(source).toContain("signOut("); expect(source).toContain('"x-csrf-token"'); expect(source).not.toContain("browserLocalPersistence");
    });
    it(`${app} session and logout routes enforce strict cookies and POST`, () => {
      const session = read(`apps/${app}/src/app/api/auth/firebase/session/route.ts`);
      const logout = read(`apps/${app}/src/app/api/auth/logout/route.ts`);
      expect(session).toContain('httpOnly: true, secure: true, sameSite: "strict", path: "/"');
      expect(session).toContain("assertRecentLogin"); expect(session).toContain("createSessionCookie");
      expect(logout).toContain("export async function POST"); expect(logout).toContain("validateCsrf");
      expect(read(`apps/${app}/src/app/logout/page.tsx`)).not.toContain("clearAdminSession");
    });
  }
});

describe("API policy registry source contracts", () => {
  it("declares explicit actor and system boundaries", () => {
    const platform = read("apps/platform-api/src/index.ts"); const office = read("apps/office-api/src/index.ts");
    expect(platform).toContain('policy: "ACTOR_AUTH_REQUIRED"'); expect(platform).toContain("external-identit");
    expect(office).toContain('policy: "ACTOR_AUTH_REQUIRED"'); expect(read("packages/auth/src/index.ts")).toContain('"SYSTEM_SERVICE_ONLY"');
    expect(platform).toContain("provider_subject"); expect(platform).not.toMatch(/where:\s*\{\s*firebaseUid/);
    expect(office).toContain('path.startsWith("/api/v1/admin/property-identity/")');
    expect(office.indexOf('path.startsWith("/api/v1/admin/property-identity/")')).toBeLessThan(office.indexOf('path.startsWith("/api/v1/admin/")'));
    const identityHandler = read("apps/office-api/src/property-identity.ts");
    expect(identityHandler).toContain("resolvePartnerScope");
    expect(identityHandler).not.toContain("hasAdminWriteAccess");
  });
});
