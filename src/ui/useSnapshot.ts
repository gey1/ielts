import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { indexSnapshot, loadSnapshot, type IndexedLibrary, type Snapshot } from '../services/library/snapshot.ts'

export function useSnapshot(): Snapshot | undefined {
  return useLiveQuery(() => loadSnapshot(), [])
}

export function useIndexed(snapshot: Snapshot | undefined): IndexedLibrary | null {
  return useMemo(() => (snapshot ? indexSnapshot(snapshot) : null), [snapshot])
}
