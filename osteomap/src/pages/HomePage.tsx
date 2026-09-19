import { useEffect, useState } from 'react'
import type { NavigateFn } from './types'
import { createSite, getAllSites, updateSite, deleteSite } from '../db/siteOperation'
import { createContext, getContextsBySiteId, updateContext, deleteContext } from '../db/contextOperation'
import { createCase, getCasesByContext, updateCaseMetadata, deleteCase } from '../db/caseOperation'
import type { SiteRecord, ContextRecord, CaseRecord, AgeGroup } from '../db/types'
import TextInputPopup from '../components/TextInputPopup'
import Metadata from '../components/Metadata'
import type { SpecimenMetadata } from '../components/Metadata'
import SkeletonPreview from '../components/SkeletonPreview'
import { Plus, Pencil, Trash2, Bone, ArrowRight, Calendar, Sparkles, MapPin, Layers, User, List, FileJson } from 'lucide-react'

function formatDate(isoString?: string): string {
  if (!isoString) return 'Recently'
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

function HomePage({ onNavigate }: { onNavigate: NavigateFn }) {
  const [sites, setSites] = useState<SiteRecord[]>([])
  const [contexts, setContexts] = useState<ContextRecord[]>([])
  const [cases, setCases] = useState<CaseRecord[]>([])
  const [siteId, setSiteId] = useState<string | null>(null)
  const [contextId, setContextId] = useState<string | null>(null)
  const [caseId, setCaseId] = useState<string | null>(null)

  const [PopSite, setPopSite] = useState(false)
  const [PopCxt, setPopCxt] = useState(false)
  const [showCaseNamePopup, setShowCaseNamePopup] = useState(false)
  const [PopMeta, setPopMeta] = useState(false)
  const [TempName, setTempName] = useState('')

  const currentSite = sites.find((s) => s.siteId === siteId)
  const currentContext = contexts.find((c) => c.contextId === contextId)
  const currentCase = cases.find((cas) => cas.caseId === caseId)

  const isSpecimenReady = Boolean(currentSite && currentContext && currentCase)
  const [prevSelection, setPrevSelection] = useState<{
    site: SiteRecord
    context: ContextRecord
    caseItem: CaseRecord
  } | null>(null)

  if (currentSite && currentContext && currentCase) {
    if (
      prevSelection?.caseItem.caseId !== currentCase.caseId ||
      prevSelection?.site.siteId !== currentSite.siteId ||
      prevSelection?.context.contextId !== currentContext.contextId ||
      prevSelection?.caseItem !== currentCase
    ) {
      setPrevSelection({
        site: currentSite,
        context: currentContext,
        caseItem: currentCase,
      })
    }
  }

  const activeCase = isSpecimenReady ? currentCase : prevSelection?.caseItem
  const activeSite = isSpecimenReady ? currentSite : prevSelection?.site
  const activeContext = isSpecimenReady ? currentContext : prevSelection?.context

  const activeSegmentStates = activeCase?.segmentStates || {}
  const activeRecordedBonesCount = Object.keys(activeSegmentStates).length
  const activeAbsentBonesCount = Object.values(activeSegmentStates).filter((s) => s === 'absent').length

  useEffect(() => {
    getAllSites().then(setSites)
  }, [])

  useEffect(() => {
    let active = true
    if (siteId) {
      getContextsBySiteId(siteId).then((res) => {
        if (active) setContexts(res)
      })
    } else {
      Promise.resolve().then(() => {
        if (active) setContexts([])
      })
    }
    return () => {
      active = false
    }
  }, [siteId])

  useEffect(() => {
    let active = true
    if (contextId) {
      getCasesByContext(contextId).then((res) => {
        if (active) setCases(res)
      })
    } else {
      Promise.resolve().then(() => {
        if (active) setCases([])
      })
    }
    return () => {
      active = false
    }
  }, [contextId])


  // --- Site buttons ---
  async function addSite(name: string) {
    const site = await createSite(name)
    setSites((prev) => [...prev, site])
    setSiteId(site.siteId)
    setContextId(null)
    setCaseId(null)
    setPopSite(false)
  }


  async function editSite(id: string) {
    const site = sites.find((s) => s.siteId === id)
    const name = window.prompt('Rename site', site?.siteName)
    if (!name) return
    await updateSite(id, name)
    setSites((prev) => prev.map((s) => (s.siteId === id ? { ...s, siteName: name } : s)))
  }

  async function removeSite(id: string) {
    if (!window.confirm('Delete this site?')) return
    await deleteSite(id)
    setSites((prev) => prev.filter((s) => s.siteId !== id))
    if (siteId === id) {
      setSiteId(null)
      setContextId(null)
      setCaseId(null)
    }
  }



  // --- Context buttons ---
  async function addContext(name: string) {
    if (!currentSite) return
    const newContext = await createContext(name, currentSite.siteId)
    setContexts((prev) => [...prev, newContext])
    setContextId(newContext.contextId)
    setCaseId(null)
    setPopCxt(false)
  }


  async function editContext(id: string) {
    if (!currentSite) return
    const ctx = contexts.find((c) => c.contextId === id)
    const name = window.prompt('Rename context', ctx?.contextName)
    if (!name) return
    await updateContext(id, name)
    setContexts((prev) => prev.map((c) => (c.contextId === id ? { ...c, contextName: name } : c)))
  }

  
  async function removeContext(id: string) {
    if (!currentSite) return
    if (!window.confirm('Delete this context?')) return
    await deleteContext(id)
    setContexts((prev) => prev.filter((c) => c.contextId !== id))
    if (contextId === id) {
      setContextId(null)
      setCaseId(null)
    }
  }



  //Case buttons
  function startAddCase() {
    if (!currentContext) return
    setShowCaseNamePopup(true)
  }


 function handleCaseNameSave(name: string) {
    setTempName(name)
    setShowCaseNamePopup(false)
    setPopMeta(true)
  }


  async function handleMetadataSave(metadata: SpecimenMetadata) {
    if (!currentContext) return
    const newCase = await createCase(currentContext.contextId, {
      caseName: TempName,
      ...metadata,
    })
    setCases((prev) => [...prev, newCase])
    setCaseId(newCase.caseId)
    setPopMeta(false)
    setTempName('')
  }


  function cancelAddCase() {
    setShowCaseNamePopup(false)
    setPopMeta(false)
    setTempName('')
  }



 async function editCase(id: string) {
    if (!currentSite || !currentContext) return
    const caseItem = cases.find((c) => c.caseId === id)
    const name = window.prompt('Rename case', caseItem?.caseName)
    const sex = window.prompt('Sex? (male/female/unknown)', caseItem?.sex) ?? 'unknown'

    const ageGroup = window.prompt('Age group? (infant/child/adolescent/adult)', caseItem?.ageGroup) as AgeGroup
      if (!name) return
      await updateCaseMetadata(id, { caseName: name, sex, ageGroup })
      setCases((prev) => prev.map((c) => (c.caseId === id ? { ...c, caseName: name, sex, ageGroup } : c)))
  }


  async function removeCase(id: string) {
    if (!currentSite || !currentContext) return
    if (!window.confirm('Delete this case?')) return
    await deleteCase(id)
    setCases((prev) => prev.filter((c) => c.caseId !== id))
    if (caseId === id) setCaseId(null)
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-16 text-left">
      <header className="border-b border-slate-200/80 bg-white/90 px-4 py-3.5 shadow-xs backdrop-blur-md">
        <div className="mx-auto max-w-5xl">
          <div className="flex flex-col items-center gap-2 text-center">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-700">
              <Bone className="h-4.5 w-4.5" />
            </div>
            <div className="min-w-0 max-w-full">
              <h1 className="text-lg font-bold text-slate-900">OsteoMap</h1>
              <p className="truncate text-xs text-slate-500">
                {currentSite?.siteName || 'Select a site'}
                {currentContext ? ' / ' + currentContext.contextName : ''}
                {currentCase ? ' / ' + currentCase.caseName : ''}
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 pt-6">
      <div className="flex flex-col gap-4 sm:flex-row">
        {/* Site column */}
        <div className="flex-1 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-xs">
          <div className="flex justify-between items-center mb-2">
            <b className="text-sm font-bold text-slate-900">Site</b>
            <button
              className="flex items-center gap-1 rounded-xl bg-sky-600 px-2.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-sky-700 transition-colors active:scale-98"
              onClick={() => setPopSite(true)}
            >
              <Plus className="h-3.5 w-3.5" />
              Add
            </button>
          </div>
          
           
          {sites.map((s) => (
            <div
              key={s.siteId}
              className={
                'group flex items-center gap-1 rounded-xl border p-1 pl-3 mb-2 shadow-xs transition-all ' +
                (s.siteId === siteId
                  ? 'border-sky-300 bg-sky-50'
                  : 'border-slate-200 bg-white hover:border-sky-300 hover:shadow-md')
              }
            >
              <button
                className={
                  'flex-1 text-left py-1.5 text-sm font-medium truncate ' +
                  (s.siteId === siteId ? 'text-sky-700' : 'text-slate-700')
                }
                onClick={() => {
                  setSiteId(s.siteId)
                  setContextId(null)
                  setCaseId(null)
                }}
              >
                {s.siteName}
              </button>
              <button
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                onClick={() => editSite(s.siteId)}
                title="Rename site"
                aria-label="Rename site"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                onClick={() => removeSite(s.siteId)}
                title="Delete site"
                aria-label="Delete site"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>


        {/* Context column */}
        <div className="flex-1 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-xs">
          <div className="flex justify-between items-center mb-2">
            <b className="text-sm font-bold text-slate-900">Context</b>
            <button
              className="flex items-center gap-1 rounded-xl bg-sky-600 px-2.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-sky-700 transition-colors active:scale-98 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none"
              onClick={() => setPopCxt(true)}
              disabled={!currentSite}
            >
              <Plus className="h-3.5 w-3.5" />
              Add
            </button>
          </div>
          

          {!currentSite && <p className="text-sm text-slate-400">pick a site first</p>}
          {contexts.map((c) => (
            <div
              key={c.contextId}
              className={
                'group flex items-center gap-1 rounded-xl border p-1 pl-3 mb-2 shadow-xs transition-all ' +
                (c.contextId === contextId
                  ? 'border-sky-300 bg-sky-50'
                  : 'border-slate-200 bg-white hover:border-sky-300 hover:shadow-md')
              }
            >
              <button
                className={
                  'flex-1 text-left py-1.5 text-sm font-medium truncate ' +
                  (c.contextId === contextId ? 'text-sky-700' : 'text-slate-700')
                }
                onClick={() => {
                setContextId(c.contextId)
                setCaseId(null)
                }}
              >
                {c.contextName}
              </button>
              <button
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                onClick={() => editContext(c.contextId)}
                title="Rename context"
                aria-label="Rename context"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                onClick={() => removeContext(c.contextId)}
                title="Delete context"
                aria-label="Delete context"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>



        {/* Specimen column */}
        <div className="flex-1 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-xs">
          <div className="flex justify-between items-center mb-2">
            <b className="text-sm font-bold text-slate-900">Specimen</b>
            <button
              className="flex items-center gap-1 rounded-xl bg-sky-600 px-2.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-sky-700 transition-colors active:scale-98 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none"
              onClick={startAddCase}
              disabled={!currentContext}
            >
              <Plus className="h-3.5 w-3.5" />
              Add
            </button>
          </div>
        
          
          {!currentContext && <p className="text-sm text-slate-400">pick a context first</p>}
          {cases.map((cas) => (
            <div
              key={cas.caseId}
              className={
                'group flex items-center gap-1 rounded-xl border p-1 pl-3 mb-2 shadow-xs transition-all ' +
                (cas.caseId === caseId
                  ? 'border-sky-300 bg-sky-50'
                  : 'border-slate-200 bg-white hover:border-sky-300 hover:shadow-md')
              }
            >
              <button
                className={
                  'flex-1 text-left py-1.5 text-sm font-medium truncate ' +
                  (cas.caseId === caseId ? 'text-sky-700' : 'text-slate-700')
                }
                onClick={() => setCaseId(cas.caseId)}
              >
                {cas.caseName}
              </button>
              <button
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                onClick={() => editCase(cas.caseId)}
                title="Edit specimen"
                aria-label="Edit specimen"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                onClick={() => removeCase(cas.caseId)}
                title="Delete specimen"
                aria-label="Delete specimen"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>



      {/* Animated Specimen Preview Card Container with smooth expansion */}
      <div
        className={`preview-expand-container ${isSpecimenReady ? 'is-expanded' : ''}`}
        aria-hidden={!isSpecimenReady}
      >
        <div className="preview-expand-content">
          {activeCase && activeSite && activeContext && (
            <div
              key={activeCase.caseId}
              className="mt-6 animate-preview-card overflow-hidden rounded-2xl border border-sky-200/90 bg-gradient-to-br from-white via-sky-50/20 to-slate-50 p-4 sm:p-5 shadow-sm transition-all"
            >
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 sm:gap-6">
                {/* Small Skeleton SVG Preview Thumbnail */}
                <div className="relative flex h-48 sm:h-52 w-full sm:w-36 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200/90 bg-slate-50/80 p-2 shadow-inner">
                  <SkeletonPreview
                    segmentStates={activeCase.segmentStates}
                    className="h-full w-full max-h-48"
                  />
                  <div className="absolute top-2 left-2 rounded-md bg-slate-900/60 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-white uppercase backdrop-blur-xs">
                    Preview
                  </div>
                </div>

                {/* Specimen Details & Meta */}
                <div className="flex flex-1 flex-col justify-between min-w-0 space-y-3">
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-100 text-sky-700">
                            <Bone className="h-4 w-4" />
                          </div>
                          <h3 className="truncate text-lg font-bold text-slate-900">
                            {activeCase.caseName}
                          </h3>
                        </div>
                        {/* Location breadcrumb */}
                        <div className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-500">
                          <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                          <span className="truncate font-medium text-slate-700">{activeSite.siteName}</span>
                          <span className="text-slate-300">/</span>
                          <Layers className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                          <span className="truncate text-slate-600">{activeContext.contextName}</span>
                        </div>
                      </div>
                    </div>

                    {/* Metadata badges */}
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {activeCase.sex && (
                        <span className="inline-flex items-center gap-1 rounded-lg bg-white border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 capitalize shadow-2xs">
                          <User className="h-3.5 w-3.5 text-slate-400" />
                          {activeCase.sex}
                        </span>
                      )}
                      {activeCase.ageGroup && (
                        <span className="inline-flex items-center rounded-lg bg-white border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 capitalize shadow-2xs">
                          {activeCase.ageGroup}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-xs font-semibold text-emerald-700 shadow-2xs">
                        <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
                        {activeRecordedBonesCount} bones recorded
                      </span>
                      {activeAbsentBonesCount > 0 && (
                        <span className="inline-flex items-center rounded-lg bg-rose-50 border border-rose-200 px-2.5 py-1 text-xs font-semibold text-rose-700 shadow-2xs">
                          {activeAbsentBonesCount} absent
                        </span>
                      )}
                    </div>

                    {/* Field notes if available */}
                    {activeCase.fieldNotes && (
                      <p className="mt-2.5 line-clamp-2 text-xs italic text-slate-500">
                        "{activeCase.fieldNotes}"
                      </p>
                    )}
                  </div>

                  {/* Action bar inside preview card */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-t border-slate-200/80 pt-3 text-xs text-slate-500">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-slate-400" />
                      <span>Modified {formatDate(activeCase.dateModified || activeCase.dateCreated)}</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => onNavigate('skeleton', activeCase.caseId)}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-sky-600 hover:bg-sky-700 active:bg-sky-800 text-white font-semibold px-5 py-2.5 shadow-sm transition-all text-sm w-full sm:w-auto cursor-pointer"
                    >
                      <span>Open Skeleton</span>
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* nav buttons at bottom */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          className="inline-flex items-center justify-center gap-2 border border-sky-600 bg-sky-600 text-white px-4 py-2 rounded-xl font-semibold hover:bg-sky-700 transition-colors shadow-xs cursor-pointer"
          onClick={() => onNavigate('my-skeletons')}
        >
          <List className="h-4 w-4" />
          View All Skeletons
        </button>

        <button
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-xs hover:bg-slate-100 transition-colors cursor-pointer"
          onClick={() => onNavigate('export')}
        >
          <FileJson className="h-4 w-4" />
          Import / Export
        </button>
      </div>

      <TextInputPopup
        isOpen={PopSite}
        title="New Site"
        label="Site name"
        placeholder="Enter site name"
        onSave={addSite}
        onCancel={() => setPopSite(false)}
      />

      <TextInputPopup
        isOpen={PopCxt}
        title="New Context"
        label="Context name"
        placeholder="Enter context name"
        onSave={addContext}
        onCancel={() => setPopCxt(false)}
      />

      <TextInputPopup
        isOpen={showCaseNamePopup}
        title="New Specimen"
        label="Specimen ID"
        placeholder="Enter specimen ID"
        onSave={handleCaseNameSave}
        onCancel={cancelAddCase}
      />

      <Metadata
        isOpen={PopMeta}
        caseName={TempName}
        onSave={handleMetadataSave}
        onCancel={cancelAddCase}
      />

      </main>
    </div>
  )
}


export default HomePage
