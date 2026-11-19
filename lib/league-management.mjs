import { fail } from "./game.mjs";
export function removeLeagueMember(l, uid, actor) {
  if (actor !== l.admin) fail("Serve il presidente di lega", 403);
  if (uid === l.admin) fail("Il presidente non può rimuovere se stesso");
  const member = l.members.find((m) => m.uid === uid);
  if (!member) fail("Partecipante non trovato", 404);
  l.members = l.members.filter((m) => m.uid !== uid);
  l.removedMembers ??= [];
  l.removedMembers.push({
    ...member,
    removedAt: new Date().toISOString(),
    removedBy: actor,
  });
  l.prizeWinners = (l.prizeWinners || []).filter((id) => id !== uid);
}
export function restoreLeagueMember(l, uid, actor) {
  if (actor !== l.admin) fail("Serve il presidente di lega", 403);
  const member = l.removedMembers?.find((m) => m.uid === uid);
  if (!member) fail("Partecipante non trovato", 404);
  if (l.members.some((m) => m.uid === uid))
    fail("Partecipante già presente", 409);
  l.removedMembers = l.removedMembers.filter((m) => m.uid !== uid);
  delete member.removedAt;
  delete member.removedBy;
  l.members.push(member);
}
