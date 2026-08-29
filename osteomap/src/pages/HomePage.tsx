import { useEffect, useState } from 'react'
import type { NavigateFn } from './types'
import { createSite, getAllSites, updateSite, deleteSite } from '../db/siteOperation'
import { createContext, getContextsBySiteId, updateContext, deleteContext } from '../db/contextOperation'
import { createCase, getCasesByContext, updateCaseMetadata, deleteCase } from '../db/caseOperation'
import type { SiteRecord, ContextRecord, CaseRecord, AgeGroup } from '../db/types'
import TextInputPopup from '../components/TextInputPopup'
import Metadata from '../components/Metadata'
import type { SpecimenMetadata } from '../components/Metadata'


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
    <div className="p-4">
      <h1 className="text-xl font-bold mb-1">OsteoMap</h1>
      <p className="text-sm text-gray-500 mb-4">
        {currentSite?.siteName}
        {currentContext ? ' > ' + currentContext.contextName : ''}
        {currentCase ? ' > ' + currentCase.caseName : ''}
      </p>


      <div className="flex flex-col gap-4 sm:flex-row">
        {/* Site column */}
        <div className="flex-1 border border-gray-300 rounded p-2">
          <div className="flex justify-between items-center mb-2">
            <b>Site</b>
            <button className="border px-2 text-sm" onClick={() => setPopSite(true)}>
              + Add
            </button>
          </div>
          
           
          {sites.map((s) => (
            <div key={s.siteId} className="flex items-center gap-1 mb-1">
              <button
                className={
                  'flex-1 text-left px-2 py-1 border ' +
                  (s.siteId === siteId ? 'bg-gray-200' : '')
                }
                onClick={() => {
                  setSiteId(s.siteId)
                  setContextId(null)
                  setCaseId(null)
                }}
              >
                {s.siteName}
              </button>
              <button className="text-sm" onClick={() => editSite(s.siteId)}>
                Edit
              </button>
              <button className="text-sm" onClick={() => removeSite(s.siteId)}>
                Del
              </button>
            </div>
          ))}
        </div>


        {/* Context column */}
        <div className="flex-1 border border-gray-300 rounded p-2">
          <div className="flex justify-between items-center mb-2">
            <b>Context</b>
            <button className="border px-2 text-sm" onClick={() => setPopCxt(true)} disabled={!currentSite}>
              + Add
            </button>
          </div>
          

          {!currentSite && <p className="text-sm text-gray-400">pick a site first</p>}
          {contexts.map((c) => (
            <div key={c.contextId} className="flex items-center gap-1 mb-1">
              <button
                className={
                  'flex-1 text-left px-2 py-1 border ' +
                  (c.contextId === contextId ? 'bg-gray-200' : '')
                }
                onClick={() => {
                setContextId(c.contextId)
                setCaseId(null)
                }}
              >
                {c.contextName}
              </button>
              <button className="text-sm" onClick={() => editContext(c.contextId)}>
                Edit
              </button>
              <button className="text-sm" onClick={() => removeContext(c.contextId)}>
                Del
              </button>
            </div>
          ))}
        </div>



        {/* Specimen column */}
        <div className="flex-1 border border-gray-300 rounded p-2">
          <div className="flex justify-between items-center mb-2">
            <b>Specimen</b>
            <button className="border px-2 text-sm" onClick={startAddCase} disabled={!currentContext}>
              + Add
            </button>
          </div>
        
          
          {!currentContext && <p className="text-sm text-gray-400">pick a context first</p>}
          {cases.map((cas) => (
            <div key={cas.caseId} className="flex items-center gap-1 mb-1">
              <button
                className={
                  'flex-1 text-left px-2 py-1 border ' +
                  (cas.caseId === caseId ? 'bg-gray-200' : '')
                }
                onClick={() => setCaseId(cas.caseId)}
              >
                {cas.caseName}
              </button>
              <button className="text-sm" onClick={() => editCase(cas.caseId)}>
                Edit
              </button>
              <button className="text-sm" onClick={() => removeCase(cas.caseId)}>
                Del
              </button>
            </div>
          ))}
        </div>
      </div>



      {/* nav buttons at bottom, just basic buttons for now */}
      <div className="mt-6 flex gap-2">
        <button
          className="border px-3 py-1"
          disabled={!currentCase}
          onClick={() => currentCase && onNavigate('skeleton', currentCase.caseId)}
        >
          Go to Skeleton Page
        </button>
        <button
          className="border px-3 py-1"
          disabled={!currentCase}
          onClick={() => currentCase && onNavigate('export', currentCase.caseId)}
        >
          Go to Export Page
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

    </div>
  )
}


export default HomePage
