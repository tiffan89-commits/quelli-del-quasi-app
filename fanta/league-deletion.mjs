import {fail} from '../lib/game.mjs';

// The Bar transaction already holds its advisory lock. Serialize with the
// pilot and random-league writers before resolving or deleting their links.
export async function linkedFantaForWipe(c, leagues, barIds) {
  if (!barIds.length) return [];
  await c.query('SELECT pg_advisory_xact_lock(826521)');
  const selected = new Set(barIds);
  const nativeLinks = leagues
    .filter(league => league.nativeFantaLink?.leagueId)
    .map(league => ({bar_league_id: league.id, fanta_league_id: league.nativeFantaLink.leagueId}));
  const nativeIds = nativeLinks.filter(link => selected.has(link.bar_league_id)).map(link => link.fanta_league_id);
  const {rows: links} = await c.query(
    "SELECT bar_league_id, fanta_league_id FROM fanta.bar_links WHERE active AND (bar_league_id=ANY($1::text[]) OR fanta_league_id=ANY($2::text[]) OR fanta_league_id IN (SELECT fanta_league_id FROM fanta.bar_links WHERE active AND bar_league_id=ANY($1::text[])))",
    [barIds, nativeIds],
  );
  const ids = new Set();
  for (const barId of barIds) {
    const targets = new Set([...nativeLinks, ...links].filter(link => link.bar_league_id === barId).map(link => link.fanta_league_id));
    if (targets.size > 1) fail('La lega ha collegamenti Bar e Fanta in conflitto.', 409);
    for (const target of targets) ids.add(target);
  }
  const liveBars = new Set(leagues.map(league => league.id));
  if ([...nativeLinks, ...links].some(link => ids.has(link.fanta_league_id) && liveBars.has(link.bar_league_id) && !selected.has(link.bar_league_id))) {
    fail('Una lega Fanta è collegata anche a un altro Bar. Verifica i collegamenti prima di cancellare.', 409);
  }
  const {rows} = await c.query('SELECT id FROM fanta.leagues WHERE id=ANY($1::text[]) ORDER BY id', [[...ids]]);
  return rows.map(row => row.id);
}

export async function deleteFantaLeagues(c, {leagueIds, barIds}) {
  if (!leagueIds.length && !barIds.length) return;
  await c.query('SELECT id FROM fanta.leagues WHERE id=ANY($1::text[]) ORDER BY id FOR UPDATE', [leagueIds]);
  await c.query('DELETE FROM fanta.creation_jobs WHERE league_id=ANY($1::text[]) OR bar_id=ANY($2::text[])', [leagueIds, barIds]);
  await c.query('DELETE FROM fanta.bar_assets WHERE league_id=ANY($1::text[])', [barIds]);
  await c.query('DELETE FROM fanta.bar_links WHERE fanta_league_id=ANY($1::text[]) OR bar_league_id=ANY($2::text[])', [leagueIds, barIds]);
  if (!leagueIds.length) return;

  for (const table of ['reference_results', 'result_revisions', 'results']) {
    await c.query('DELETE FROM fanta.' + table + ' WHERE matchup_id IN (SELECT id FROM fanta.matchups WHERE league_id=ANY($1::text[]))', [leagueIds]);
  }
  for (const table of ['auction_actions', 'lots']) {
    await c.query('DELETE FROM fanta.' + table + ' WHERE auction_id IN (SELECT id FROM fanta.auctions WHERE league_id=ANY($1::text[]))', [leagueIds]);
  }
  await c.query("DELETE FROM fanta.notifications WHERE data->>'league'=ANY($1::text[])", [leagueIds]);
  // Team logos and persistent player bindings are removed by their foreign keys.
  for (const table of [
    'sales', 'auctions', 'lineups', 'matchups', 'rounds', 'competitions',
    'rosters', 'roster_entries', 'roster_changes', 'pilot_claims', 'import_issues', 'teams',
  ]) {
    await c.query('DELETE FROM fanta.' + table + ' WHERE league_id=ANY($1::text[])', [leagueIds]);
  }
  await c.query('DELETE FROM fanta.leagues WHERE id=ANY($1::text[])', [leagueIds]);
  if(process.env.SELFHOST_RUNTIME==='true')for(const league of leagueIds)await c.query("SELECT pg_notify('quasi_auction',$1)",[JSON.stringify({league,deleted:true})]);
}
