import { Finder } from '../Finder'
import type { View } from '../../types-nav'
import type { WorkspaceView } from './WorkspaceApp'

export function FindJournalsView({ go }: { go: (v: WorkspaceView) => void }) {
  const navigate = (v: View) => {
    // Inside the workspace shell the public "Home" breadcrumb resolves to the
    // workspace overview; "Journal Finder" is already the current view.
    if (v === 'home') go({ name: 'overview' })
  }
  return <Finder onNavigate={navigate} onStartUpload={() => go({ name: 'new' })} />
}
