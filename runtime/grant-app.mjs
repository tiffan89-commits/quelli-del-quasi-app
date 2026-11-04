import {connection,closeDatabase} from '../lib/db.mjs';
// Run with the database owner's connection, never with the web app credentials.
const password=process.env.APP_DB_PASSWORD;
if(!password||password.length<24)throw Error('APP_DB_PASSWORD deve avere almeno 24 caratteri');
const c=await connection();try{
 await c.query('BEGIN');if(!(await c.query("SELECT 1 FROM pg_roles WHERE rolname='quasi_app'")).rows.length)await c.query('CREATE ROLE quasi_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE');
 const sql=(await c.query("SELECT format('ALTER ROLE quasi_app PASSWORD %L', $1::text) AS sql",[password])).rows[0].sql;await c.query(sql);
 await c.query('GRANT USAGE ON SCHEMA public,fanta TO quasi_app');
 await c.query('GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public,fanta TO quasi_app');
 await c.query('GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public,fanta TO quasi_app');
 await c.query('ALTER DEFAULT PRIVILEGES IN SCHEMA public,fanta GRANT SELECT,INSERT,UPDATE,DELETE ON TABLES TO quasi_app');
 await c.query('ALTER DEFAULT PRIVILEGES IN SCHEMA public,fanta GRANT USAGE,SELECT ON SEQUENCES TO quasi_app');await c.query('COMMIT');console.log('Permessi quasi_app configurati senza privilegi amministrativi');
}catch(e){await c.query('ROLLBACK');console.error(e.code||e.name);process.exitCode=1;}finally{c.release();await closeDatabase();}
