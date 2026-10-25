import { useWorkspace } from '../../workspace/WorkspaceContext'
import { Finder } from '../Finder'
import type { View } from '../../types-nav'

export function FindJournalsView() {
  const navigate = (_v: View) => {
    /* The public Finder is hosted inside the workspace shell here; its
       breadcrumbs (Home / Journal Finder) resolve against the public
       routes, so a cross-app navigation inside the shell is a no-op. */
  }
  return <Finder onNavigate={navigate} />
}
