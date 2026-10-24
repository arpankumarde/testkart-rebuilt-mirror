import {type GeneratedAlways, Kysely, CamelCasePlugin} from 'kysely'
import {PostgresJSDialect} from 'kysely-postgres-js'
import {DB} from './schema'
import postgres from 'postgres'

export const db = new Kysely<DB>({
plugins: [new CamelCasePlugin()],
dialect: new PostgresJSDialect({
postgres: postgres(process.env.DATABASE_URL, {
prepare: false,
// Lowered from 20s: the DB (cn1.testkart.in, max_connections=100) has been
// running at/over its connection limit under real traffic - every warm
// serverless instance holds one open connection for up to idle_timeout
// seconds even when doing nothing, so shortening this frees slots faster.
// This alone cannot fix a server-side limit that's genuinely too low for
// the instance count at this traffic level - see the connection-pooling
// recommendation this change shipped alongside.
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