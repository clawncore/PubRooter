import type { Project } from '../types'

const KEY = 'pubrooter.projects.v1'

export function loadProjects(): Project[] {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Project[]) : []
  } catch {
    return []
  }
}

export function saveProject(project: Project): void {
  const projects = loadProjects().filter((p) => p.id !== project.id)
  project.updatedAt = new Date().toISOString()
  projects.unshift(project)
  localStorage.setItem(KEY, JSON.stringify(projects.slice(0, 50)))
}

export function deleteProject(id: string): void {
  localStorage.setItem(KEY, JSON.stringify(loadProjects().filter((p) => p.id !== id)))
}

export function uid(): string {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`
}
