import { defineConfig } from 'drizzle-kit'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env' })
dotenv.config({ path: '.env.local', override: true })

if (!process.env.DIRECT_URL) {
  throw new Error('DIRECT_URL is not set. Check .env or .env.local')
}

export default defineConfig({
  schema: './src/db/schema/index.ts',
  out: './migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DIRECT_URL,
    ssl: true,
  },
})
