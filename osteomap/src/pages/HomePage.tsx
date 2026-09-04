import { useEffect, useState } from 'react'
import type { NavigateFn } from './types'
import { createSite, getAllSites, updateSite, deleteSite } from '../db/siteOperation'
import { createContext, getContextsBySiteId, updateContext, deleteContext } from '../db/contextOperation'
import { createCase, getCasesByContext, updateCaseMetadata, deleteCase } from '../db/caseOperation'
import type { SiteRecord, ContextRecord, CaseRecord, AgeGroup } from '../db/types'
import TextInputPopup from '../components/TextInputPopup'
import Metadata from '../components/Metadata'
import type { SpecimenMetadata } from '../components/Metadata'
import { Plus, Pencil, Trash2 } from 'lucide-react'


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

  useEffect(() => {
    getAllSites().then(setSites)
  }, [])

  useEffect(() => {
    if (!siteId) return setContexts([])
    getContextsBySiteId(siteId).then(setContexts)
  }, [siteId])

  useEffect(() => {
    if (!contextId) return setCases([])
    getCasesByContext(contextId).then(setCases)
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
    <div className="min-h-screen bg-slate-50 text-slate-800 p-4">
      <div className="mb-4">
        <h1 className="text-lg font-bold text-slate-900 mb-1">OsteoMap</h1>
        <p className="text-sm text-slate-500">
          {currentSite?.siteName}
          {currentContext ? ' > ' + currentContext.contextName : ''}
          {currentCase ? ' > ' + currentCase.caseName : ''}
        </p>
      </div>


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



      {/* nav buttons at bottom */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
         <button
          className="border border-sky-600 bg-sky-600 text-white px-4 py-2 rounded-xl font-semibold hover:bg-sky-700 transition-colors shadow-xs"
          onClick={() => onNavigate('my-skeletons')}
        >
          View All Skeletons
        </button>

        <button
          className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-xs hover:bg-slate-100 transition-colors"
          onClick={() => onNavigate('export')}
        >
          Go to Import Page
        </button>

        {currentSite && currentContext && currentCase && (
          <button
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-xl font-semibold transition-all shadow-sm flex items-center gap-2"
            onClick={() => onNavigate('skeleton', currentCase.caseId)}
          >
            Create Skeleton →
          </button>
        )}
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

    </div>
  )
}


export default HomePage
