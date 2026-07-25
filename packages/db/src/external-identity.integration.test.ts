import { exec } from "node:child_process";
import { promisify } from "node:util";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { GenericContainer, Wait, type StartedTestContainer } from "testcontainers";
import { PrismaClient } from "@prisma/client";

const run = promisify(exec);
let container: StartedTestContainer; let prisma: PrismaClient;

describe("external identity migration on disposable PostgreSQL 16", () => {
  beforeAll(async () => {
    container = await new GenericContainer("postgres:16-alpine")
      .withEnvironment({ POSTGRES_USER:"kvartal_test",POSTGRES_PASSWORD:"kvartal_test",POSTGRES_DB:"kvartal_test" })
      .withExposedPorts(5432).withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/)).start();
    const url=`postgresql://kvartal_test:kvartal_test@127.0.0.1:${container.getMappedPort(5432)}/kvartal_test?schema=public`;
    await run("pnpm exec prisma migrate deploy --schema prisma/schema.prisma",{cwd:process.cwd(),env:{...process.env,DATABASE_URL:url}});
    prisma=new PrismaClient({datasources:{db:{url}}}); await prisma.$connect();
  },120_000);
  afterAll(async()=>{await prisma?.$disconnect();await container?.stop();},30_000);

  it("enforces lifetime subject uniqueness and one active Firebase identity per AppUser",async()=>{
    const user=await prisma.appUser.create({data:{firebaseUid:"legacy:test:1",email:"one@test.invalid",active:true}});
    const first=await prisma.appUserExternalIdentity.create({data:{appUserId:user.id,provider:"FIREBASE",subject:"real-uid-1"}});
    await expect(prisma.appUserExternalIdentity.create({data:{appUserId:user.id,provider:"FIREBASE",subject:"real-uid-2"}})).rejects.toThrow();
    await prisma.appUserExternalIdentity.update({where:{id:first.id},data:{status:"REVOKED"}});
    await expect(prisma.appUserExternalIdentity.create({data:{appUserId:user.id,provider:"FIREBASE",subject:"real-uid-2"}})).resolves.toMatchObject({status:"ACTIVE"});
    const other=await prisma.appUser.create({data:{firebaseUid:"legacy:test:2",email:"two@test.invalid",active:true}});
    await expect(prisma.appUserExternalIdentity.create({data:{appUserId:other.id,provider:"FIREBASE",subject:"real-uid-1"}})).rejects.toThrow();
  });

  it("enforces one pending request per type/provider/subject but permits a replacement after cancellation",async()=>{
    const data={requestType:"BIND" as const,provider:"FIREBASE" as const,subject:"pending-uid",subjectDigest:"digest",requestedByProvider:"FIREBASE" as const,requestedBySubject:"reviewer",requestedBySubjectDigest:"reviewer-digest",reason:"Controlled test request",expiresAt:new Date(Date.now()+86_400_000)};
    const first=await prisma.externalIdentityBindingRequest.create({data});
    await expect(prisma.externalIdentityBindingRequest.create({data})).rejects.toThrow();
    await prisma.externalIdentityBindingRequest.update({where:{id:first.id},data:{status:"CANCELLED"}});
    await expect(prisma.externalIdentityBindingRequest.create({data})).resolves.toMatchObject({status:"PENDING"});
  });
});
