import "server-only";
import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { supabaseServer } from "./supabase/server";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function requireUser(): Promise<User> {
  const sb = await supabaseServer();
  const { data } = await sb.auth.getUser();
  if (!data.user) throw new ApiError(401, "Sessão expirada. Entre de novo.");
  return data.user;
}

/** Envolve um handler: erros viram JSON { error } com status certo */
export function handler<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (e) {
      if (e instanceof ApiError) return NextResponse.json({ error: e.message }, { status: e.status });
      console.error(e);
      const msg = e instanceof Error ? e.message : "Erro inesperado";
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  };
}

export async function readJson<T>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new ApiError(400, "Requisição inválida.");
  }
}

export function ok(data: unknown = { ok: true }) {
  return NextResponse.json(data);
}
