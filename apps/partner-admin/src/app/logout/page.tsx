"use client";
import { useState } from "react";
export default function LogoutPage() { const [busy,setBusy]=useState(false); return <main className="grid min-h-screen place-items-center"><button disabled={busy} onClick={async()=>{setBusy(true);const csrf=await fetch("/api/auth/csrf").then(r=>r.json()) as {csrfToken:string};const response=await fetch("/api/auth/logout",{method:"POST",headers:{"x-csrf-token":csrf.csrfToken}});if(response.ok)location.assign("/login");else setBusy(false);}}>{busy?"Выходим...":"Выйти безопасно"}</button></main>; }
