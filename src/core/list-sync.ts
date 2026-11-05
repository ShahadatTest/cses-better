import { getSupabase } from './supabase';
import { getProblemLists, saveProblemLists } from './storage';
import { ProblemList } from './types';

const running = new Map<string, Promise<boolean>>();
const queued = new Set<string>();
const sameContent = (a: ProblemList, b: ProblemList) => a.name === b.name && a.deleted === b.deleted && JSON.stringify(a.problemIds) === JSON.stringify(b.problemIds);
export function syncProblemLists(owner: string): Promise<boolean> {
  const existing = running.get(owner);
  if (existing) { queued.add(owner); return existing; }
  const promise = (async () => {
    let complete: boolean;
    do { queued.delete(owner); complete = await synchronize(owner); } while (queued.has(owner));
    return complete;
  })().finally(() => { running.delete(owner); queued.delete(owner); });
  running.set(owner, promise);
  return promise;
}

async function synchronize(owner: string): Promise<boolean> {
  const client = getSupabase();
  if (!client) return false;
  try {
    const { data: session } = await client.auth.getSession();
    if (session.session?.user.id !== owner) return false;
    const { data, error } = await client.from('user_problem_lists').select('*').eq('user_id', owner);
    if (error) return false;
    const remote = new Map<string, ProblemList>((data || []).map(row => [row.id, { id: row.id, name: row.name, problemIds: row.problem_ids, revision: row.revision, deleted: row.deleted, dirty: false }]));
    const snapshot = getProblemLists(owner);
    let complete = true;
    for (const original of snapshot) {
      let local = getProblemLists(owner).find(item => item.id === original.id);
      if (!local || !local.dirty) continue;
      const cloud = remote.get(local.id);
      if (cloud && cloud.revision !== local.revision) {
        if (cloud.revision === local.revision + 1 && sameContent(local, cloud)) {
          saveProblemLists(getProblemLists(owner).map(item => item.id === local!.id ? cloud : item), owner, false);
          continue;
        }
        // Preserve both versions, and persist the new ID before sending it so retries are idempotent.
        const source = local.deleted ? cloud : local;
        const recovered = { ...source, id: crypto.randomUUID(), name: `${source.name.slice(0, 108)} (recovered)`, revision: 0, dirty: true };
        if (local.deleted) {
          local = { ...local, revision: cloud.revision };
          saveProblemLists(getProblemLists(owner).map(item => item.id === local!.id ? local! : item).concat(recovered), owner, false);
          snapshot.push(recovered);
        } else {
          saveProblemLists(getProblemLists(owner).map(item => item.id === local!.id ? cloud : item).concat(recovered), owner, false);
          local = recovered;
        }
        if (typeof window !== 'undefined') window.dispatchEvent(new Event('cses-lists-recovered'));
      }
      const sent = local;
      const payload = { user_id: owner, id: sent.id, name: sent.name, problem_ids: sent.problemIds, deleted: sent.deleted, revision: sent.revision + 1 };
      const result = sent.revision === 0
        ? await client.from('user_problem_lists').insert(payload).select('revision').single()
        : await client.from('user_problem_lists').update(payload).eq('user_id', owner).eq('id', sent.id).eq('revision', sent.revision).select('revision').single();
      if (result.error || !result.data) { complete = false; continue; }
      const current = getProblemLists(owner);
      saveProblemLists(current.map(item => item.id === sent.id ? { ...item, revision: result.data.revision, dirty: !sameContent(item, sent) } : item), owner, false);
      remote.set(sent.id, { ...sent, revision: result.data.revision, dirty: false });
    }
    const latest = getProblemLists(owner);
    for (const cloud of remote.values()) {
      if (!latest.some(item => item.id === cloud.id)) latest.push(cloud);
      else {
        const index = latest.findIndex(item => item.id === cloud.id);
        if (!latest[index].dirty && latest[index].revision < cloud.revision) latest[index] = cloud;
      }
    }
    saveProblemLists(latest, owner, false);
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('cses-lists-refreshed'));
    return complete && !latest.some(item => item.dirty);
  } catch { return false; }
}
