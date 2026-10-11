import type { EditorialResponse, SectionSnapshot } from './cms-editorial';

export type EditorialMutation = (op: 'save' | 'publish', state: EditorialResponse, snapshot?: SectionSnapshot) => Promise<EditorialResponse>;

/** Save first, then publish using the version returned by that save. */
export async function publishSectionChanges(state: EditorialResponse, snapshot: SectionSnapshot, mutate: EditorialMutation) {
  if (state.document.draft && state.document.draftBaseHash !== state.liveHash) {
    throw new Error('Konten website berubah sejak draf dibuat. Periksa perbedaannya, lalu simpan draf sebelum menayangkan.');
  }
  let next = state;
  if (JSON.stringify(snapshot) !== JSON.stringify(state.document.draft ?? state.live)) {
    next = await mutate('save', state, snapshot);
  }
  return next.document.draft ? mutate('publish', next) : next;
}
