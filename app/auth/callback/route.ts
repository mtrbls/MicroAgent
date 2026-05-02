import { NextResponse } from "next/server"

// This route handles the OAuth callback from Composio
// After the user authorizes, Composio redirects here
export async function GET(request: Request) {
  const url = new URL(request.url)
  const mateId = url.searchParams.get("mate")
  
  // Redirect back to the main app - the mate detail will auto-refresh
  const redirectUrl = new URL("/", request.url)
  if (mateId) {
    redirectUrl.searchParams.set("openMate", mateId)
  }
  
  return NextResponse.redirect(redirectUrl)
}
