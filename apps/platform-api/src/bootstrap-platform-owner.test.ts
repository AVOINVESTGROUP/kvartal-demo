import { describe, expect, it } from "vitest";
import { bootstrapPlatformOwner } from "./bootstrap-platform-owner.js";

function fixture(options:{owner?:boolean;verified?:boolean}={}) {
  let state:any=null; let txCalls=0; const events:any[]=[]; const identities:any[]=[];
  const prisma:any={
    appUser:{findUnique:async()=>({id:"owner-1",active:true,platformRoleAssignments:[{active:options.owner!==false,role:"platform_owner"}]})},
    externalIdentityBootstrapState:{findUnique:async()=>state},
    appUserExternalIdentity:{findFirst:async()=>null},
    $transaction:async(fn:any)=>{txCalls++;return fn({
      $executeRaw:async()=>undefined,
      appUserExternalIdentity:{findFirst:async()=>null,create:async({data}:any)=>{const row={id:"identity-1",...data};identities.push(row);return row;}},
      externalIdentityBindingEvent:{create:async({data}:any)=>{const row={id:"event-1",...data};events.push(row);return row;}},
      externalIdentityBootstrapState:{findUnique:async()=>state,upsert:async({create}:any)=>{state=create;return state;}},
    });},
  };
  return {prisma,getFirebaseUser:async(uid:string)=>({uid,emailVerified:options.verified!==false}),get state(){return state;},get txCalls(){return txCalls;},events,identities};
}
const args={appUserId:"owner-1",firebaseUid:"firebase-real-uid",reason:"Initial controlled bootstrap",dryRun:false};
const input=(f:ReturnType<typeof fixture>,overrides:Record<string,unknown>={})=>({args,confirmation:"dev",suppliedSecret:"correct-secret",expectedSecret:"correct-secret",enabled:true,environment:"dev",prisma:f.prisma,getFirebaseUser:f.getFirebaseUser,...overrides} as any);

describe("one-time platform owner bootstrap",()=>{
  it("succeeds once and creates a normal audit event",async()=>{const f=fixture();const result=await bootstrapPlatformOwner(input(f));expect(result.dryRun).toBe(false);expect(f.events[0].eventType).toBe("BOOTSTRAP_COMPLETED");await expect(bootstrapPlatformOwner(input(f))).rejects.toMatchObject({code:"BOOTSTRAP_ALREADY_COMPLETED"});});
  it("rejects wrong secret, non-owner and unverified email",async()=>{await expect(bootstrapPlatformOwner(input(fixture(),{suppliedSecret:"wrong"}))).rejects.toThrow(/secret/i);await expect(bootstrapPlatformOwner(input(fixture({owner:false})))).rejects.toThrow(/platform_owner/);await expect(bootstrapPlatformOwner(input(fixture({verified:false})))).rejects.toThrow(/verified/);});
  it("dry-run changes nothing",async()=>{const f=fixture();const result=await bootstrapPlatformOwner(input(f,{args:{...args,dryRun:true}}));expect(result.dryRun).toBe(true);expect(f.txCalls).toBe(0);});
});
