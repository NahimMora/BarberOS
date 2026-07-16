import 'dotenv/config'
import { readFileSync } from 'fs'
import postgres from 'postgres'

const filePath = process.argv[2]
if (!filePath) {
  throw new Error('Usage: tsx scripts/ci/apply-sql.ts <path-to-sql-file>')
}
if (!process.env.DIRECT_URL) {
  throw new Error('DIRECT_URL is not set. Check .env or .env.local')
}

const sql = postgres(process.env.DIRECT_URL, { max: 1 })

async function main() {
  const statements = readFileSync(filePath, 'utf-8')
  await sql.unsafe(statements)
  console.log(`Applied ${filePath}`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => sql.end())
