import { headers } from "next/headers"

/**
 * Returns the authenticated user id for the current request. The middleware
 * verifies Basic Auth credentials against the users table and forwards the
 * verified id as the `x-user-id` request header. If this throws, the
 * middleware didn't run or didn't authenticate — the route should not
 * have been reachable.
 */
export async function getUserId(): Promise<string> {
  const h = await headers()
  const userId = h.get("x-user-id")
  if (!userId) {
    throw new Error(
      "No x-user-id on request — middleware should have rejected this call."
    )
  }
  return userId
}
