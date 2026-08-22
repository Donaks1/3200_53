import { useState } from 'react'
import type { NavigateFn } from './types'

type Specimen = { id: string; name: string }
type Context = { id: string; name: string; specimens: Specimen[] }
type Site = { id: string; name: string; contexts: Context[] }


const initialSites: Site[] = [
  {
    id: 's1',
    name: 'Site 1',
    contexts: [
      {
        id: 'c1',
        name: 'Context 1',
        specimens: [
          { id: 'sp1', name: 'Specimen 1' },
          { id: 'sp2', name: 'Specimen 2' },
        ],
      },
      { id: 'c2', name: 'Context 2', specimens: [] },
    ],
  },
  {
    id: 's2',
    name: 'Site 2',
    contexts: [],
  },
]

function HomePage({ onNavigate }: { onNavigate: NavigateFn }) {
  const [sites, setSites] = useState<Site[]>(initialSites)
  const [siteId, setSiteId] = useState<string | null>(null)
  const [contextId, setContextId] = useState<string | null>(null)
  const [specimenId, setSpecimenId] = useState<string | null>(null)

  const currentSite = sites.find((s) => s.id === siteId)
  const currentContext = currentSite?.contexts.find((c) => c.id === contextId)
  const currentSpecimen = currentContext?.specimens.find((sp) => sp.id === specimenId)


  // --- Site buttons ---
  function addSite() {
    const name = window.prompt('Site name?')
    if (!name) return
    setSites([...sites, { id: Date.now().toString(), name, contexts: [] }])
  }

  function editSite(id: string) {
    const site = sites.find((s) => s.id === id)
    const name = window.prompt('Rename site', site?.name)
    if (!name) return
    setSites(sites.map((s) => (s.id === id ? { ...s, name } : s)))
  }

  function deleteSite(id: string) {
    if (!window.confirm('Delete this site?')) return
    setSites(sites.filter((s) => s.id !== id))
    if (siteId === id) {
      setSiteId(null)
      setContextId(null)
      setSpecimenId(null)
    }
  }



  // --- Context buttons ---
  function addContext() {
    if (!currentSite) return
    const name = window.prompt('Context name?')
    if (!name) return
    const newContext = { id: Date.now().toString(), name, specimens: [] }
    setSites(
      sites.map((s) =>
        s.id === currentSite.id ? { ...s, contexts: [...s.contexts, newContext] } : s,
      ),
    )
  }

  function editContext(id: string) {
    if (!currentSite) return
    const ctx = currentSite.contexts.find((c) => c.id === id)
    const name = window.prompt('Rename context', ctx?.name)
    if (!name) return
    setSites(
      sites.map((s) =>
        s.id !== currentSite.id
          ? s
          : { ...s, contexts: s.contexts.map((c) => (c.id === id ? { ...c, name } : c)) },
      ),
    )
  }

  
  function deleteContext(id: string) {
    if (!currentSite) return
    if (!window.confirm('Delete this context?')) return
    setSites(
      sites.map((s) =>
        s.id !== currentSite.id ? s : { ...s, contexts: s.contexts.filter((c) => c.id !== id) },
      ),
    )
    if (contextId === id) {
      setContextId(null)
      setSpecimenId(null)
    }
  }



  //Specimen buttons
  function addSpecimen() {
    if (!currentSite || !currentContext) return
    const name = window.prompt('Specimen name?')
    if (!name) return
    const newSpecimen = { id: Date.now().toString(), name }
    setSites(
      sites.map((s) =>
        s.id !== currentSite.id
          ? s
          : {
              ...s,
              contexts: s.contexts.map((c) =>
                c.id === currentContext.id ? { ...c, specimens: [...c.specimens, newSpecimen] } : c,
              ),
            },
      ),
    )
  }

  function editSpecimen(id: string) {
    if (!currentSite || !currentContext) return
    const spec = currentContext.specimens.find((sp) => sp.id === id)
    const name = window.prompt('Rename specimen', spec?.name)
    if (!name) return
    setSites(
      sites.map((s) =>
        s.id !== currentSite.id
          ? s
          : {
              ...s,
              contexts: s.contexts.map((c) =>
                c.id !== currentContext.id
                  ? c
                  : { ...c, specimens: c.specimens.map((sp) => (sp.id === id ? { ...sp, name } : sp)) },
              ),
            },
      ),
    )
  }

  function deleteSpecimen(id: string) {
    if (!currentSite || !currentContext) return
    if (!window.confirm('Delete this specimen?')) return
    setSites(
      sites.map((s) =>
        s.id !== currentSite.id
          ? s
          : {
              ...s,
              contexts: s.contexts.map((c) =>
                c.id !== currentContext.id
                  ? c
                  : { ...c, specimens: c.specimens.filter((sp) => sp.id !== id) },
              ),
            },
      ),
    )
    if (specimenId === id) setSpecimenId(null)
  }

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-1">OsteoMap</h1>
      <p className="text-sm text-gray-500 mb-4">
        {currentSite?.name}
        {currentContext ? ' > ' + currentContext.name : ''}
        {currentSpecimen ? ' > ' + currentSpecimen.name : ''}
      </p>


      <div className="flex flex-col gap-4 sm:flex-row">
        {/* Site column */}
        <div className="flex-1 border border-gray-300 rounded p-2">
          <div className="flex justify-between items-center mb-2">
            <b>Site</b>
            <button className="border px-2 text-sm" onClick={addSite}>
              + Add
            </button>
          </div>
          {sites.map((s) => (
            <div key={s.id} className="flex items-center gap-1 mb-1">
              <button
                className={
                  'flex-1 text-left px-2 py-1 border ' +
                  (s.id === siteId ? 'bg-gray-200' : '')
                }
                onClick={() => {
                  setSiteId(s.id)
                  setContextId(null)
                  setSpecimenId(null)
                }}
              >
                {s.name}
              </button>
              <button className="text-sm" onClick={() => editSite(s.id)}>
                Edit
              </button>
              <button className="text-sm" onClick={() => deleteSite(s.id)}>
                Del
              </button>
            </div>
          ))}
        </div>


        {/* Context column */}
        <div className="flex-1 border border-gray-300 rounded p-2">
          <div className="flex justify-between items-center mb-2">
            <b>Context</b>
            <button className="border px-2 text-sm" onClick={addContext} disabled={!currentSite}>
              + Add
            </button>
          </div>
          {!currentSite && <p className="text-sm text-gray-400">pick a site first</p>}
          {currentSite?.contexts.map((c) => (
            <div key={c.id} className="flex items-center gap-1 mb-1">
              <button
                className={
                  'flex-1 text-left px-2 py-1 border ' +
                  (c.id === contextId ? 'bg-gray-200' : '')
                }
                onClick={() => {
                  setContextId(c.id)
                  setSpecimenId(null)
                }}
              >
                {c.name}
              </button>
              <button className="text-sm" onClick={() => editContext(c.id)}>
                Edit
              </button>
              <button className="text-sm" onClick={() => deleteContext(c.id)}>
                Del
              </button>
            </div>
          ))}
        </div>



        {/* Specimen column */}
        <div className="flex-1 border border-gray-300 rounded p-2">
          <div className="flex justify-between items-center mb-2">
            <b>Specimen</b>
            <button className="border px-2 text-sm" onClick={addSpecimen} disabled={!currentContext}>
              + Add
            </button>
          </div>
          {!currentContext && <p className="text-sm text-gray-400">pick a context first</p>}
          {currentContext?.specimens.map((sp) => (
            <div key={sp.id} className="flex items-center gap-1 mb-1">
              <button
                className={
                  'flex-1 text-left px-2 py-1 border ' +
                  (sp.id === specimenId ? 'bg-gray-200' : '')
                }
                onClick={() => setSpecimenId(sp.id)}
              >
                {sp.name}
              </button>
              <button className="text-sm" onClick={() => editSpecimen(sp.id)}>
                Edit
              </button>
              <button className="text-sm" onClick={() => deleteSpecimen(sp.id)}>
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
          disabled={!currentSpecimen}
          onClick={() => onNavigate('skeleton')}
        >
          Go to Skeleton Page
        </button>
        <button
          className="border px-3 py-1"
          disabled={!currentSpecimen}
          onClick={() => onNavigate('export')}
        >
          Go to Export Page
        </button>
      </div>
    </div>
  )
}

export default HomePage
