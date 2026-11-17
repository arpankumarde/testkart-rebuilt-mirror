import {type GeneratedAlways, Kysely, CamelCasePlugin} from 'kysely'
import {PostgresJSDialect} from 'kysely-postgres-js'
import {DB} from './schema'
import postgres from 'postgres'

export const db = new Kysely<DB>({
plugins: [new CamelCasePlugin()],
dialect: new PostgresJSDialect({
postgres: postgres(process.env.DATABASE_URL, {
prepare: false,
// Down from the 30s default: when CN1 stops answering (23-11-2026), each
// request waits through 4 connect attempts, so a short wait makes it fail
// in seconds instead of minutes. A healthy connect takes well under 1s.
connect_timeout: 5,
// Every warm serverless instance holds one open connection for up to
// idle_timeout seconds, so a short value frees slots under CN1's
// max_connections (150, no pooler) faster.
idle_timeout: 8,
// Safety net against a connection that never reports idle for some reason
// (a driver-level edge case, not an expected case) - forces a hard close
// and reconnect after 10 minutes so a stuck connection can't hold a slot
// indefinitely.
max_lifetime: 60 * 10,
max: 1,
}),
}),
})