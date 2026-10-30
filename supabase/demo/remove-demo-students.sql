/*
 * Removes the demo students added by add-demo-students.sql: every account with an email ending in
 * @demo.invalid. Their profiles, logs and follows are removed with them (the same cascade as "Delete
 * my account"). Real accounts are not touched.
 *
 * How to run: Supabase dashboard → SQL Editor → paste this file → Run.
 */
delete from auth.users where email like '%@demo.invalid';
