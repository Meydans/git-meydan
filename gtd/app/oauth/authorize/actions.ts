"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  authorizeKeys,
  checkAuthorizeRequest,
  checkConsentToken,
  issueCode,
  withParams,
  type AuthorizeParams,
} from "@/lib/oauth";
import { currentOrigin } from "@/lib/origin";
import { checkPassword, isValidSession, SESSION_COOKIE, startSession } from "@/lib/session";

function paramsFrom(formData: FormData): AuthorizeParams {
  const params: AuthorizeParams = {};
  for (const key of authorizeKeys) {
    const value = formData.get(key);
    if (typeof value === "string" && value !== "") params[key] = value;
  }
  return params;
}

// Everything is re-validated here: the hidden fields are client input like any other.
async function validated(formData: FormData) {
  const params = paramsFrom(formData);
  const origin = await currentOrigin();
  const consent = formData.get("consent");
  if (typeof consent !== "string" || !checkConsentToken(params, consent)) redirect("/oauth/authorize?invalid=1");
  const check = await checkAuthorizeRequest(params, origin);
  if (!check.ok) redirect("redirect" in check ? check.redirect : "/oauth/authorize?invalid=1");
  return { params, origin, check };
}

export async function approve(formData: FormData) {
  const { params, origin, check } = await validated(formData);

  const signedIn = isValidSession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!signedIn) {
    const password = formData.get("password");
    if (typeof password !== "string" || !checkPassword(password)) {
      redirect(withParams(`${origin}/oauth/authorize`, { ...params, login_error: "1" }));
    }
    await startSession();
  }

  const code = await issueCode(check);
  redirect(withParams(check.redirectUri, { code, state: params.state, iss: origin }));
}

export async function deny(formData: FormData) {
  const { params, origin, check } = await validated(formData);
  redirect(withParams(check.redirectUri, { error: "access_denied", state: params.state, iss: origin }));
}
