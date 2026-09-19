import { useEffect, useState, useMemo } from 'react'
import type { NavigateFn } from './types'
import { getAllCases, deleteCase, updateCaseMetadata } from '../db/caseOperation'
import { getAllSites } from '../db/siteOperation'
import { db } from '../db/db'
import type { CaseRecord, SiteRecord, ContextRecord } from '../db/types'
import SkeletonPreview from '../components/SkeletonPreview'
import { 
  Search, 
  ArrowLeft, 
  Trash2, 
  FileText, 
  Calendar, 
  User, 
  Bone, 
  MapPin, 
  Layers, 
  Plus, 
  ChevronRight,
  Sparkles,
  Pencil,
  X,
  Check
} from 'lucide-react'

interface MySkeletonsProps {
  onNavigate: NavigateFn
}

interface SkeletonItem extends CaseRecord {
  siteName?: string
  contextName?: string
  zonesCount: number
}

function formatDate(isoString: string): string {
  try {
    const d = new Date(isoString)
    if (isNaN(d.getTime())) return isoString
    return d.toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return isoString
  }
}

function MySkeletons({ onNavigate }: MySkeletonsProps) {
  const [skeletons, setSkeletons] = useState<SkeletonItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState<'recent' | 'name'>('recent')
  const [editingSkeleton, setEditingSkeleton] = useState<SkeletonItem | null>(null)
  const [editName, setEditName] = useState('')
  const [editSex, setEditSex] = useState('')
  const [editAgeGroup, setEditAgeGroup] = useState<SkeletonItem['ageGroup']>('adult')
  const [editNotes, setEditNotes] = useState('')

  useEffect(() => {
    let active = true

    async function loadData() {
      try {
        const [casesData, sitesData, contextsData] = await Promise.all([
          getAllCases(),
          getAllSites(),
          db.contexts.toArray() as Promise<ContextRecord[]>,
        ])

        if (!active) return

        const sitesMap = new Map<string, SiteRecord>(sitesData.map((s) => [s.siteId, s]))
        const contextsMap = new Map<string, ContextRecord>(contextsData.map((c) => [c.contextId, c]))

        const enriched: SkeletonItem[] = casesData.map((c) => {
          const ctx = contextsMap.get(c.contextId)
          const site = ctx ? sitesMap.get(ctx.siteId) : undefined
          const zonesCount = c.segmentStates ? Object.keys(c.segmentStates).length : 0

          return {
            ...c,
            siteName: site?.siteName || 'Unassigned Site',
            contextName: ctx?.contextName || 'Unassigned Context',
            zonesCount,
          }
        })

        setSkeletons(enriched)
      } catch (err) {
        console.error('Failed to load skeletons:', err)
      } finally {
        if (active) setLoading(false)
      }
    }

    loadData()

    return () => {
      active = false
    }
  }, [])

  async function handleDelete(caseId: string, caseName: string, event: React.MouseEvent) {
    event.stopPropagation()
    if (!window.confirm(`Are you sure you want to delete "${caseName}"? This action cannot be undone.`)) {
      return
    }

    try {
      await deleteCase(caseId)
      setSkeletons((prev) => prev.filter((item) => item.caseId !== caseId))
    } catch (err) {
      console.error('Failed to delete skeleton:', err)
      alert('Could not delete skeleton. Please try again.')
    }
  }

  function startEdit(item: SkeletonItem, event: React.MouseEvent) {
    event.stopPropagation()
    setEditingSkeleton(item)
    setEditName(item.caseName)
    setEditSex(item.sex || 'unknown')
    setEditAgeGroup(item.ageGroup || 'adult')
    setEditNotes(item.fieldNotes || '')
  }

  function cancelEdit() {
    setEditingSkeleton(null)
    setEditName('')
    setEditSex('')
    setEditAgeGroup('adult')
    setEditNotes('')
  }

  async function handleEditSave() {
    if (!editingSkeleton) return

    const nextName = editName.trim()
    if (!nextName) return

    try {
      const updates = {
        caseName: nextName,
        sex: editSex || 'unknown',
        ageGroup: editAgeGroup,
        fieldNotes: editNotes,
      }

      await updateCaseMetadata(editingSkeleton.caseId, updates)
      const dateModified = new Date().toISOString()
      setSkeletons((prev) =>
        prev.map((item) =>
          item.caseId === editingSkeleton.caseId
            ? { ...item, ...updates, dateModified }
            : item,
        ),
      )
      cancelEdit()
    } catch (err) {
      console.error('Failed to update skeleton:', err)
      alert('Could not update skeleton. Please try again.')
    }
  }

  const filteredSkeletons = useMemo(() => {
    const query = searchTerm.trim().toLowerCase()
    let result = skeletons

    if (query) {
      result = result.filter((item) => {
        return (
          item.caseName.toLowerCase().includes(query) ||
          (item.siteName && item.siteName.toLowerCase().includes(query)) ||
          (item.contextName && item.contextName.toLowerCase().includes(query)) ||
          (item.sex && item.sex.toLowerCase().includes(query)) ||
          (item.ageGroup && item.ageGroup.toLowerCase().includes(query))
        )
      })
    }

    return [...result].sort((a, b) => {
      if (sortBy === 'name') {
        return a.caseName.localeCompare(b.caseName)
      }
      // default: most recently modified
      const dateA = new Date(a.dateModified || a.dateCreated || 0).getTime()
      const dateB = new Date(b.dateModified || b.dateCreated || 0).getTime()
      return dateB - dateA
    })
  }, [skeletons, searchTerm, sortBy])

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-16 text-left">
      {/* Top Header */}
      <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/90 px-4 py-3.5 backdrop-blur-md shadow-xs">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => onNavigate('home')}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
              aria-label="Back to Home"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-slate-900">My Skeletons</h1>
                <span className="rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-semibold text-sky-700">
                  {skeletons.length}
                </span>
              </div>
              <p className="text-xs text-slate-500">Manage and load your recorded skeletal specimens</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onNavigate('home')}
            className="flex items-center gap-1.5 rounded-xl bg-sky-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-sky-700 active:scale-98"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">New Specimen</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="mx-auto max-w-5xl px-4 pt-6">
        {/* Controls: Search and Sort */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by skeleton name, site, context, or age..."
              className="w-full rounded-2xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-800 placeholder-slate-400 shadow-xs outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-500">Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'recent' | 'name')}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-xs outline-none focus:border-sky-500"
            >
              <option value="recent">Recently Modified</option>
              <option value="name">Name (A–Z)</option>
            </select>
          </div>
        </div>

        {/* Skeletons List */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-sky-600 border-t-transparent mb-3" />
            <p className="text-sm">Loading skeletons from database...</p>
          </div>
        ) : filteredSkeletons.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-white/60 px-6 py-16 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-50 text-sky-600">
              <Bone className="h-7 w-7" />
            </div>
            {searchTerm ? (
              <>
                <h2 className="text-base font-semibold text-slate-800">No matching skeletons found</h2>
                <p className="mt-1 text-sm text-slate-500">
                  No specimen matches "{searchTerm}". Try another search term.
                </p>
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Clear Search
                </button>
              </>
            ) : (
              <>
                <h2 className="text-base font-semibold text-slate-800">No skeletons recorded yet</h2>
                <p className="mt-1 max-w-sm text-sm text-slate-500">
                  Create your first skeletal record from the home page to start mapping bones and zones.
                </p>
                <button
                  type="button"
                  onClick={() => onNavigate('home')}
                  className="mt-4 flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-sky-700"
                >
                  <Plus className="h-4 w-4" />
                  Create First Specimen
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2">
            {filteredSkeletons.map((item) => (
              <div
                key={item.caseId}
                onClick={() => onNavigate('skeleton', item.caseId)}
                className="group relative flex cursor-pointer flex-col sm:flex-row gap-4 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-sky-300 hover:shadow-md"
              >
                {/* Left: Non-interactive Skeleton SVG Preview */}
                <div className="relative flex h-48 sm:h-auto sm:w-28 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-50/90 border border-slate-100 p-1.5 transition-colors group-hover:bg-sky-50/40">
                  <SkeletonPreview segmentStates={item.segmentStates} className="h-full w-full max-h-44" />
                </div>

                {/* Right: Specimen Details and Actions */}
                <div className="flex flex-1 flex-col justify-between min-w-0">
                  <div>
                    {/* Top line: Name and Actions */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-sky-600 group-hover:bg-sky-600 group-hover:text-white transition-colors">
                            <Bone className="h-3.5 w-3.5" />
                          </div>
                          <h2 className="truncate text-base font-bold text-slate-900 group-hover:text-sky-700">
                            {item.caseName}
                          </h2>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100">
                        <button
                          type="button"
                          onClick={(e) => startEdit(item, e)}
                          className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                          title="Edit skeleton"
                          aria-label="Edit skeleton"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            onNavigate('export', item.caseId)
                          }}
                          className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                          title="Export record"
                          aria-label="Export skeleton"
                        >
                          <FileText className="h-4 w-4" />
                        </button>

                        <button
                          type="button"
                          onClick={(e) => handleDelete(item.caseId, item.caseName, e)}
                          className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                          title="Delete record"
                          aria-label="Delete skeleton"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    {/* Breadcrumb / Location */}
                    <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
                      <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                      <span className="truncate font-medium text-slate-700">{item.siteName}</span>
                      <span className="text-slate-300">/</span>
                      <Layers className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                      <span className="truncate text-slate-600">{item.contextName}</span>
                    </div>

                    {/* Metadata Tags */}
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {item.ageGroup && (
                        <span className="inline-flex items-center rounded-lg bg-slate-100 px-2 py-0.5 text-[11px] font-medium capitalize text-slate-600">
                          {item.ageGroup}
                        </span>
                      )}
                      {item.sex && (
                        <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-0.5 text-[11px] font-medium capitalize text-slate-600">
                          <User className="h-3 w-3 text-slate-400" />
                          {item.sex}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                        <Sparkles className="h-3 w-3" />
                        {item.zonesCount} recorded
                      </span>
                    </div>

                    {/* Field Notes preview if available */}
                    {item.fieldNotes && (
                      <p className="mt-2 line-clamp-2 text-xs italic text-slate-400">
                        "{item.fieldNotes}"
                      </p>
                    )}
                  </div>

                  {/* Card Footer: Date and Load CTA */}
                  <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5 text-xs text-slate-400">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5 text-slate-400" />
                      <span>{formatDate(item.dateModified || item.dateCreated)}</span>
                    </div>

                    <div className="flex items-center font-semibold text-sky-600 group-hover:translate-x-0.5 transition-transform">
                      <span>Load</span>
                      <ChevronRight className="h-4 w-4 ml-0.5" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {editingSkeleton && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 py-6 backdrop-blur-sm"
          onClick={cancelEdit}
        >
          <div
            className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white text-left shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="border-b border-slate-200 bg-slate-50/80 px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-700">
                    <Bone className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-base font-bold text-slate-900">Edit skeleton</h2>
                    <p className="truncate text-xs font-medium text-slate-500">
                      {editingSkeleton.siteName} / {editingSkeleton.contextName}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-white hover:text-slate-700"
                  onClick={cancelEdit}
                  aria-label="Close edit skeleton"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="space-y-4 px-5 py-5">
              <label className="block text-sm font-semibold text-slate-700">
                Skeleton ID
                <input
                  value={editName}
                  onChange={(event) => setEditName(event.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                  placeholder="Skeleton ID"
                />
              </label>

              <label className="block text-sm font-semibold text-slate-700">
                Sex
                <select
                  value={editSex}
                  onChange={(event) => setEditSex(event.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                >
                  <option value="unknown">Unknown</option>
                  <option value="female">Female</option>
                  <option value="male">Male</option>
                </select>
              </label>

              <label className="block text-sm font-semibold text-slate-700">
                Age group
                <select
                  value={editAgeGroup}
                  onChange={(event) => setEditAgeGroup(event.target.value as SkeletonItem['ageGroup'])}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                >
                  <option value="infant">Infant</option>
                  <option value="child">Child</option>
                  <option value="adolescent">Adolescent</option>
                  <option value="adult">Adult</option>
                </select>
              </label>

              <label className="block text-sm font-semibold text-slate-700">
                General notes
                <textarea
                  value={editNotes}
                  onChange={(event) => setEditNotes(event.target.value)}
                  className="mt-1.5 min-h-28 w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                  rows={4}
                  placeholder="Field notes, condition, provenance, etc."
                />
              </label>
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50/60 px-5 py-4 sm:flex-row sm:justify-end">
              <button
                type="button"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-xs transition-colors hover:bg-slate-100"
                onClick={cancelEdit}
              >
                Cancel
              </button>
              <button
                type="button"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
                onClick={handleEditSave}
                disabled={!editName.trim()}
              >
                <Check className="h-4 w-4" />
                Save changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default MySkeletons
