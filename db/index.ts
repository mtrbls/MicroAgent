import { neon } from "@neondatabase/serverless"

export const sql = neon(process.env.DATABASE_URL!)

export const DEFAULT_USER_ID = process.env.DEFAULT_USER_ID || "user_demo"
