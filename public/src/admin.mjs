let data = null,
  entity = "",
  currentPage = 0,
  loading = false,
  query = "";
const fmt = (n) => Number(n || 0).toLocaleString("it-IT");
export function adminView(esc, toolsHtml = "", introHtml = "") {
  const labels = {
    users: "Account (anche admin)",
    verified: "Email verificate",
    leagues: "Leghe",
    memberships: "Partecipazioni",
    rounds: "Giornate",
    slips: "Schedine",
    sessions: "Sessioni attive",
    connections: "Collegamenti esterni",
    chatMessages: "Messaggi chat",

    finalMatches: "Partite finali",
    archivedDetails: "Tabellini archiviati",
  };
  return (
    '<section class="hero"><div class="eyebrow">TIFFANO · AMMINISTRAZIONE DI SISTEMA</div><h1>Dietro il bancone.</h1><p>Utenti, leghe, dati e motori del bar.</p><button class="secondary" id="admin-refresh">Aggiorna dati</button> <button class="secondary" id="admin-logout">Logout</button></section><div id="admin-status" role="status">' +
    (loading ? "Caricamento…" : "") +
    "</div>" + introHtml +
    (data
      ? '<details class="card"><summary>Totali dell’archivio</summary><div class="admin-stats">' +
        Object.entries(data.summary)
          .map(
            ([key, value]) =>
              '<article class="card"><span class="muted tiny">' +
              labels[key] +
              "</span><strong>" +
              fmt(value) +
              "</strong></article>",
          )
          .join("") +
        '</div></details>' + toolsHtml + '<section class="card"><h2>Accessi e chiamate</h2><p class="tiny muted">Le statistiche vengono raccolte da questa versione' +
        (data.stats.startedAt
          ? " · dal " +
            new Date(data.stats.startedAt).toLocaleString("it-IT", {
              timeZone: "Europe/Rome",
            })
          : "") +
        '. Nessuna cronologia precedente viene inventata.</p><div class="admin-table-wrap"><table class="rule-table"><thead><tr><th>Giorno UTC</th><th>Richieste app</th><th>Errori</th><th>Utenti attivi</th></tr></thead><tbody>' +
        Object.entries(data.stats.days || {})
          .sort()
          .reverse()
          .map(
            ([day, v]) =>
              "<tr><td>" +
              day +
              "</td><td>" +
              fmt(v.requests) +
              "</td><td>" +
              fmt(v.errors) +
              "</td><td>" +
              Object.keys(v.users).length +
              "</td></tr>",
          )
          .join("") +
        "</tbody></table></div><details><summary>Dettaglio chiamate API</summary><pre>" +
        esc(JSON.stringify(data.stats.days, null, 2)) +
        "</pre></details><details><summary>Chiamate ai servizi esterni</summary><pre>" +
        esc(JSON.stringify(data.external, null, 2)) +
        "</pre></details><details><summary>Ultimi accessi</summary><pre>" +
        esc(JSON.stringify(data.access, null, 2)) +
        '</pre></details></section><section class="card"><h2>Sincronizzazioni</h2><pre>' +
        esc(JSON.stringify(data.workers, null, 2)) +
        '</pre></section><section class="card"><h2>Esplora database</h2><p class="tiny muted">Tutte le sezioni sono consultabili. Password, sessioni e chiavi rimangono riservate.</p><label class="field">Sezione<select id="admin-entity"><option value="">Scegli una sezione</option>' +
        data.entities
          .map(
            (key) =>
              '<option value="' +
              esc(key) +
              '" ' +
              (entity === key ? "selected" : "") +
              ">" +
              esc(key) +
              "</option>",
          )
          .join("") +
        '</select></label><form id="admin-search" class="row"><label class="field">Cerca nei record<input type="search" name="q" maxlength="100" value="' +
        esc(query) +
        '" placeholder="Nome, username, email, ID…"></label><button class="secondary">Cerca</button></form><div id="admin-records"></div></section>'
      : "")
  );
}
export function setAdminData(value){data=value;}
export function bindAdmin({ api, render, esc, onLogout, onData=()=>{} }) {
  async function load() {
    if (loading) return;
    loading = true;
    try {
      data = await api("platform");
      onData(data);
    } catch (e) {
      const el = document.querySelector("#admin-status");
      if (el) el.textContent = e.message;
      return;
    } finally {
      loading = false;
    }
    render();
  }
  document.querySelector("#admin-refresh").onclick = load;
  document.querySelector("#admin-logout").onclick = onLogout;
  async function records() {
    const target = document.querySelector("#admin-records");
    if (!target || !entity) return;
    target.textContent = "Caricamento…";
    try {
      const result = await api(
        "platform?" +
          new URLSearchParams({ entity, page: currentPage, q: query }),
      );
      target.innerHTML =
        '<p class="tiny muted">' +
        result.total +
        " record · pagina " +
        (currentPage + 1) +
        "</p>" +
        adminRecords(result.rows, entity, esc) +
        '<div class="row"><button class="secondary" id="admin-prev" ' +
        (!currentPage ? "disabled" : "") +
        '>← Precedenti</button><button class="secondary" id="admin-next" ' +
        ((currentPage + 1) * 25 >= result.total ? "disabled" : "") +
        ">Successivi →</button></div>";
      document.querySelector("#admin-prev").onclick = () => {
        currentPage--;
        records();
      };
      document.querySelector("#admin-next").onclick = () => {
        currentPage++;
        records();
      };
    } catch (e) {
      target.textContent = e.message;
    }
  }
  const search = document.querySelector("#admin-search");
  if (search)
    search.onsubmit = (e) => {
      e.preventDefault();
      query = search.elements.q.value;
      currentPage = 0;
      records();
    };
  const select = document.querySelector("#admin-entity");
  if (select) {
    select.onchange = () => {
      entity = select.value;
      currentPage = 0;
      records();
    };
    if (entity) records();
  }
  if (!data) load();
}

export function clearAdminState() {
  data = null;
  entity = "";
  query = "";
  currentPage = 0;
}

function adminRecords(rows, entity, esc) {
  const date = (value) =>
    value
      ? new Date(value).toLocaleString("it-IT", { timeZone: "Europe/Rome" })
      : "—";
  if (entity === "users")
    return (
      '<div class="admin-table-wrap"><table class="rule-table"><thead><tr><th>Utente</th><th>Email</th><th>Verifica</th><th>Ultimo accesso</th><th>Ultima attività</th></tr></thead><tbody>' +
      rows
        .map(
          (u) =>
            "<tr><td><b>" +
            esc(u.username) +
            "</b><br>" +
            esc(u.name) +
            "</td><td>" +
            esc(u.email || "—") +
            "</td><td>" +
            (u.adminOnly ? "Account di sistema" : u.emailVerified ? "Verificata" : "Da verificare") +
            "</td><td>" +
            esc(date(u.lastLoginAt)) +
            "</td><td>" +
            esc(date(u.lastSeenAt)) +
            "</td></tr>",
        )
        .join("") +
      "</tbody></table></div><details><summary>Record completi degli utenti</summary><pre>" +
      esc(JSON.stringify(rows, null, 2)) +
      "</pre></details>"
    );
  return (
    rows
      .map(
        (row, i) =>
          "<details><summary>" +
          esc(
            row.name ||
              row.username ||
              row.id ||
              row.key ||
              "Record " + (i + 1),
          ) +
          "</summary><pre>" +
          esc(JSON.stringify(row, null, 2)) +
          "</pre></details>",
      )
      .join("") || '<p class="muted">Nessun record.</p>'
  );
}
