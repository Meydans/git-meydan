import { NextResponse } from "next/server";
import { appUrl } from "../../../../lib/auth/google";
import { deleteSession } from "../../../../lib/auth/session";

export async function POST() {
  await deleteSession();
  return NextResponse.redirect(`${appUrl()}/login`, 303);
}
