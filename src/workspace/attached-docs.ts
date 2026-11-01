import type { AttachedDoc, ManuscriptProject } from './types'

/**
 * Single source of truth for a project's attached documents.
 * Prefers the project field (local mode); falls back to the per-device
 * localStorage mirror used in cloud mode.
 */
export function loadAttachedDocs(project: ManuscriptProject): AttachedDoc[] {
  if (project.attachedDocs && project.attachedDocs.length > 0) return project.attachedDocs
  try {
    return JSON.parse(localStorage.getItem(`pubrooter.docs.${project.id}`) || '[]')
  } catch {
    return []
  }
}
