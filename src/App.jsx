import { useCallback, useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import { Moon, Plus, Pencil, Trash2, Sun } from 'lucide-react'
import echo from './echo'

const api = axios.create({ baseURL: 'http://127.0.0.1:8000/api' })
const PER_PAGE = 10

function formatRupiah(n) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n)
}

function Pagination({ page, totalPages, onChange, dark }) {
  if (totalPages <= 1) return null
  const pages = []
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= page - 1 && i <= page + 1)) {
      pages.push(i)
    } else if (pages[pages.length - 1] !== '...') {
      pages.push('...')
    }
  }
  const b = dark ? 'border-slate-600 text-slate-300 hover:bg-slate-700' : 'border-slate-200 text-slate-600 hover:bg-slate-100'
  return (
    <div className="flex items-center justify-center gap-1 mt-4">
      <button
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
        className={`px-3 py-1 text-xs rounded-lg border ${b} disabled:opacity-30 cursor-pointer disabled:cursor-default transition`}
      >
        Sebelumnya
      </button>
      {pages.map((p, i) =>
        p === '...' ? (
          <span key={`e${i}`} className="px-1 text-xs text-slate-400">...</span>
        ) : (
          <button
            key={p}
            onClick={() => onChange(p)}
            className={`px-3 py-1 text-xs rounded-lg border cursor-pointer transition ${
              p === page
                ? 'bg-blue-600 text-white border-blue-600'
                : b
            }`}
          >
            {p}
          </button>
        ),
      )}
      <button
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
        className={`px-3 py-1 text-xs rounded-lg border ${b} disabled:opacity-30 cursor-pointer disabled:cursor-default transition`}
      >
        Selanjutnya
      </button>
    </div>
  )
}

function App() {
  const [dark, setDark] = useState(false)
  const [activeMenu, setActiveMenu] = useState('dashboard')
  const [barangs, setBarangs] = useState([])
  const [loading, setLoading] = useState(true)

  const [newForm, setNewForm] = useState({ nama_barang: '', harga: '' })
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({ nama_barang: '', harga_estimasi: '' })
  const [confirmHarga, setConfirmHarga] = useState({})

  const [selectedIds, setSelectedIds] = useState([])
  const [belumPage, setBelumPage] = useState(1)
  const [sudahPage, setSudahPage] = useState(1)

  useEffect(() => {
    if (dark) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [dark])

  const belumDibeli = useMemo(() => barangs.filter((b) => !b.is_dibeli), [barangs])
  const sudahDibeli = useMemo(() => barangs.filter((b) => b.is_dibeli), [barangs])

  const belumTotalPages = Math.ceil(belumDibeli.length / PER_PAGE)
  const sudahTotalPages = Math.ceil(sudahDibeli.length / PER_PAGE)

  const belumCurrent = useMemo(
    () => belumDibeli.slice((belumPage - 1) * PER_PAGE, belumPage * PER_PAGE),
    [belumDibeli, belumPage],
  )
  const sudahCurrent = useMemo(
    () => sudahDibeli.slice((sudahPage - 1) * PER_PAGE, sudahPage * PER_PAGE),
    [sudahDibeli, sudahPage],
  )

  const totalPengeluaran = useMemo(
    () => sudahDibeli.reduce((sum, b) => sum + Number(b.harga_final), 0),
    [sudahDibeli],
  )

  const fetchBarangs = useCallback(async () => {
    try {
      const { data } = await api.get('/barang')
      setBarangs(data.data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchBarangs() }, [fetchBarangs])

  useEffect(() => {
    echo.channel('shopping-channel')
      .listen('.barang.event', (e) => {
        setBarangs((prev) => {
          if (e.action === 'CREATED' && !prev.some((b) => b.id === e.data.id))
            return [e.data, ...prev]
          if (e.action === 'UPDATED')
            return prev.map((b) => (b.id === e.data.id ? e.data : b))
          if (e.action === 'DELETED')
            return prev.filter((b) => b.id !== e.data.id)
          return prev
        })
      })
    return () => echo.leave('shopping-channel')
  }, [])

  async function handleAdd(e) {
    e.preventDefault()
    if (!newForm.nama_barang.trim()) return

    const payload = { nama_barang: newForm.nama_barang }
    if (newForm.harga && Number(newForm.harga) > 0) {
      payload.harga_estimasi = Number(newForm.harga)
      payload.harga_final = Number(newForm.harga)
    }

    await api.post('/barang', payload)
    setNewForm({ nama_barang: '', harga: '' })
  }

  function startEdit(barang) {
    setEditingId(barang.id)
    setEditForm({ nama_barang: barang.nama_barang, harga_estimasi: String(barang.harga_estimasi) })
  }

  async function saveEdit(id) {
    const payload = {}
    if (editForm.nama_barang.trim()) payload.nama_barang = editForm.nama_barang
    if (editForm.harga_estimasi) payload.harga_estimasi = Number(editForm.harga_estimasi)
    await api.patch(`/barang/${id}`, payload)
    setEditingId(null)
  }

  function startConfirm(id) {
    setConfirmHarga((prev) => ({ ...prev, [id]: '' }))
  }

  async function confirmBeli(barang) {
    const hf = confirmHarga[barang.id]
    if (!hf) return
    await api.patch(`/barang/${barang.id}/toggle-status`, {
      is_dibeli: true,
      harga_final: Number(hf),
    })
    setConfirmHarga((prev) => {
      const next = { ...prev }
      delete next[barang.id]
      return next
    })
  }

  function cancelConfirm(id) {
    setConfirmHarga((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
  }

  async function handleDelete(id) {
    await api.delete(`/barang/${id}`)
  }

  function toggleSelect(id) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    )
  }

  function toggleSelectAll(ids) {
    if (ids.every((id) => selectedIds.includes(id))) {
      setSelectedIds((prev) => prev.filter((id) => !ids.includes(id)))
    } else {
      setSelectedIds((prev) => [...new Set([...prev, ...ids])])
    }
  }

  async function handleDeleteSelected() {
    await Promise.all(selectedIds.map((id) => api.delete(`/barang/${id}`)))
    setSelectedIds([])
  }

  async function handleDeleteAll(ids) {
    await Promise.all(ids.map((id) => api.delete(`/barang/${id}`)))
    setSelectedIds([])
  }

  if (loading) {
    return (
      <div className={`flex items-center justify-center min-h-screen ${dark ? 'bg-slate-900' : 'bg-slate-50'}`}>
        <p className="text-slate-400 text-lg">Memuat...</p>
      </div>
    )
  }

  const navItem = (key, label) => (
    <button
      onClick={() => setActiveMenu(key)}
      className={`px-5 py-2 rounded-xl text-sm font-semibold transition cursor-pointer ${
        activeMenu === key
          ? `${dark ? 'bg-slate-700 text-white border-slate-600' : 'bg-white text-slate-800 border-slate-200'} shadow-sm border`
          : `${dark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-700'}`
      }`}
    >
      {label}
    </button>
  )

  function renderBulkBar(ids, label) {
    if (ids.length === 0) return null
    return (
      <div className="flex items-center gap-2 mb-3">
        <button
          onClick={() => handleDeleteAll(ids)}
          className={`flex items-center gap-1.5 text-xs font-semibold ${dark ? 'text-red-400 bg-red-900/30 hover:bg-red-900/50' : 'text-red-600 bg-red-50 hover:bg-red-100'} px-3 py-1.5 rounded-xl transition cursor-pointer`}
        >
          <Trash2 size={14} />
          Hapus Semua
        </button>
        {selectedIds.length > 0 && (
          <button
            onClick={handleDeleteSelected}
            className={`flex items-center gap-1.5 text-xs font-semibold ${dark ? 'text-red-400 bg-red-900/30 hover:bg-red-900/50' : 'text-red-600 bg-red-50 hover:bg-red-100'} px-3 py-1.5 rounded-xl transition cursor-pointer`}
          >
            <Trash2 size={14} />
            Hapus Terpilih ({selectedIds.length})
          </button>
        )}
      </div>
    )
  }

  function renderSelectCheckbox(id) {
    return (
      <input
        type="checkbox"
        checked={selectedIds.includes(id)}
        onChange={() => toggleSelect(id)}
        className={`w-4 h-4 rounded ${dark ? 'border-slate-600' : 'border-slate-300'} text-blue-600 focus:ring-blue-500 cursor-pointer accent-blue-600`}
      />
    )
  }

  function renderSelectAllCheckbox(ids) {
    if (ids.length === 0) return null
    const allSelected = ids.every((id) => selectedIds.includes(id))
    return (
      <input
        type="checkbox"
        checked={allSelected}
        onChange={() => toggleSelectAll(ids)}
        className={`w-4 h-4 rounded ${dark ? 'border-slate-600' : 'border-slate-300'} text-blue-600 focus:ring-blue-500 cursor-pointer accent-blue-600`}
      />
    )
  }

  return (
    <div className={`min-h-screen ${dark ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-900'} transition-colors`}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        <div className="flex items-center justify-between mb-6">
          <h1 className={`text-2xl sm:text-3xl font-bold ${dark ? 'text-white' : 'text-slate-800'}`}>Belanjaan</h1>
          <div className="flex items-center gap-3">
            <span               className={`text-sm ${dark ? 'text-slate-500' : 'text-slate-400'}`}>{barangs.length} barang</span>
            <button
              onClick={() => setDark((d) => !d)}
              className={`p-2 rounded-xl ${dark ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200'} border transition cursor-pointer`}
            >
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </div>

        <nav className={`flex items-center gap-2 ${dark ? 'bg-slate-800 border-slate-700' : 'bg-slate-100 border-slate-200'} rounded-2xl p-1.5 mb-8 w-fit border`}>
          {navItem('dashboard', 'Dashboard')}
          {navItem('data', 'Data Belanjaan')}
        </nav>

        {activeMenu === 'dashboard' && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
              <div className={`${dark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} rounded-2xl shadow-sm border p-5`}>
                <p className={`text-xs font-semibold ${dark ? 'text-slate-400' : 'text-slate-500'} uppercase tracking-wide mb-1`}>Total Pengeluaran</p>
                <p className="text-2xl font-bold text-green-600">{formatRupiah(totalPengeluaran)}</p>
              </div>
              <div className={`${dark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} rounded-2xl shadow-sm border p-5`}>
                <p className={`text-xs font-semibold ${dark ? 'text-slate-400' : 'text-slate-500'} uppercase tracking-wide mb-1`}>Belum Dibeli</p>
                <p className="text-2xl font-bold text-amber-500">{belumDibeli.length}</p>
              </div>
              <div className={`${dark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} rounded-2xl shadow-sm border p-5`}>
                <p className={`text-xs font-semibold ${dark ? 'text-slate-400' : 'text-slate-500'} uppercase tracking-wide mb-1`}>Sudah Dibeli</p>
                <p className="text-2xl font-bold text-green-500">{sudahDibeli.length}</p>
              </div>
            </div>

          </>    
        )}

        {activeMenu === 'data' && (
          <>
            <form onSubmit={handleAdd} className={`${dark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} rounded-2xl shadow-sm border p-5 mb-8 flex flex-wrap gap-3 items-end`}>
              <div className="flex-1 min-w-[200px]">
                <label className={`block text-xs font-semibold ${dark ? 'text-slate-400' : 'text-slate-500'} uppercase tracking-wide mb-1.5`}>Nama Barang</label>
                <input
                  value={newForm.nama_barang}
                  onChange={(e) => setNewForm((f) => ({ ...f, nama_barang: e.target.value }))}
                  className={`w-full border ${dark ? 'border-slate-600 bg-slate-700 text-white' : 'border-slate-200 bg-slate-50 text-slate-800'} rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition placeholder:text-slate-400`}
                  placeholder="Nama barang..."
                />
              </div>
              <div className="w-40">
                <label className={`block text-xs font-semibold ${dark ? 'text-slate-400' : 'text-slate-500'} uppercase tracking-wide mb-1.5`}>Harga (Rp)</label>
                <input
                  type="number"
                  value={newForm.harga}
                  onChange={(e) => setNewForm((f) => ({ ...f, harga: e.target.value }))}
                  className={`w-full border ${dark ? 'border-slate-600 bg-slate-700 text-white' : 'border-slate-200 bg-slate-50 text-slate-800'} rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition placeholder:text-slate-400`}
                  placeholder="Kosongkan jika belum dibeli"
                  min="0"
                />
              </div>
              <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition cursor-pointer shadow-sm flex items-center gap-1.5">
                <Plus size={18} />
                Tambah
              </button>
            </form>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                  <h2 className={`text-sm font-semibold ${dark ? 'text-slate-200' : 'text-slate-700'} uppercase tracking-wide`}>Belum Dibeli</h2>
                  <span className={`text-xs ${dark ? 'text-slate-500' : 'text-slate-400'}`}>({belumDibeli.length})</span>
                </div>

                {renderBulkBar(
                  belumCurrent.map((b) => b.id),
                  'Belum Dibeli',
                )}

                <div className="flex items-center gap-2 mb-3">
                  {renderSelectAllCheckbox(belumCurrent.map((b) => b.id))}
                  {belumCurrent.length > 0 && (
                    <span className={`text-xs ${dark ? 'text-slate-500' : 'text-slate-400'}`}>Pilih semua</span>
                  )}
                </div>

                <div className="space-y-3">
                  {belumCurrent.length === 0 && (
                    <p className={`text-sm ${dark ? 'text-slate-500 bg-slate-800 border-slate-700' : 'text-slate-400 bg-white border-slate-200'} text-center py-8 rounded-2xl border`}>Semua sudah dibeli!</p>
                  )}
                  {belumCurrent.map((barang) => (
                    <div key={barang.id} className={`${dark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} rounded-2xl shadow-sm border p-4`}>
                      <div className="flex items-center gap-3">
                        {confirmHarga[barang.id] !== undefined ? (
                          <div className="flex items-center gap-2 flex-1">
                            <input
                              type="number"
                              value={confirmHarga[barang.id]}
                              onChange={(e) => setConfirmHarga((prev) => ({ ...prev, [barang.id]: e.target.value }))}
                              className={`flex-1 border ${dark ? 'border-slate-600' : 'border-slate-200'} rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 ${dark ? 'bg-slate-700 text-white' : 'bg-slate-50 text-slate-800'}`}
                              placeholder="Harga final"
                              min="0"
                              autoFocus
                            />
                            <button onClick={() => confirmBeli(barang)} className="text-green-600 hover:text-green-800 text-sm font-semibold cursor-pointer">Ok</button>
                            <button onClick={() => cancelConfirm(barang.id)} className={`${dark ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'} text-sm cursor-pointer`}>Batal</button>
                          </div>
                        ) : (
                          <>
                            {renderSelectCheckbox(barang.id)}
                            <button onClick={() => startConfirm(barang.id)} className={`w-5 h-5 rounded-md border-2 ${dark ? 'border-slate-600' : 'border-slate-300'} hover:border-green-400 transition flex-shrink-0 cursor-pointer`} />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium ${dark ? 'text-white' : 'text-slate-800'} truncate">{barang.nama_barang}</p>
                              <p className="text-xs ${dark ? 'text-slate-500' : 'text-slate-400'}">{formatRupiah(barang.harga_estimasi)}</p>
                            </div>
                            <div className="flex items-center gap-1">
                              {editingId === barang.id ? (
                                <div className="flex items-center gap-1.5">
                                  <input
                                    value={editForm.nama_barang}
                                    onChange={(e) => setEditForm((f) => ({ ...f, nama_barang: e.target.value }))}
                                    className={`w-24 border ${dark ? 'border-slate-600' : 'border-slate-200'} rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/30 ${dark ? 'bg-slate-700 text-white' : 'bg-slate-50 text-slate-800'}`}
                                  />
                                  <input
                                    type="number"
                                    value={editForm.harga_estimasi}
                                    onChange={(e) => setEditForm((f) => ({ ...f, harga_estimasi: e.target.value }))}
                                    className={`w-20 border ${dark ? 'border-slate-600' : 'border-slate-200'} rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/30 ${dark ? 'bg-slate-700 text-white' : 'bg-slate-50 text-slate-800'}`}
                                    min="0"
                                  />
                                  <button onClick={() => saveEdit(barang.id)} className="text-green-600 text-xs font-semibold cursor-pointer">Simpan</button>
                                  <button onClick={() => setEditingId(null)} className="text-slate-400 text-xs cursor-pointer">Batal</button>
                                </div>
                              ) : (
                                <>
                                  <button onClick={() => startEdit(barang)} className={`${dark ? 'text-slate-500 hover:text-blue-400' : 'text-slate-400 hover:text-blue-600'} transition cursor-pointer`}>
                                    <Pencil size={16} />
                                  </button>
                                  <button onClick={() => handleDelete(barang.id)} className={`${dark ? 'text-slate-500 hover:text-red-400' : 'text-slate-400 hover:text-red-500'} transition cursor-pointer`}>
                                    <Trash2 size={16} />
                                  </button>
                                </>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <Pagination page={belumPage} totalPages={belumTotalPages} onChange={setBelumPage} dark={dark} />
              </section>

              <section>
                <div className="flex items-center gap-2 mb-4">
                  <span className="w-2.5 h-2.5 rounded-full bg-green-400" />
                  <h2 className={`text-sm font-semibold ${dark ? 'text-slate-200' : 'text-slate-700'} uppercase tracking-wide`}>Sudah Dibeli</h2>
                  <span className={`text-xs ${dark ? 'text-slate-500' : 'text-slate-400'}`}>({sudahDibeli.length})</span>
                </div>

                {renderBulkBar(
                  sudahCurrent.map((b) => b.id),
                  'Sudah Dibeli',
                )}

                <div className="flex items-center gap-2 mb-3">
                  {renderSelectAllCheckbox(sudahCurrent.map((b) => b.id))}
                  {sudahCurrent.length > 0 && (
                    <span className={`text-xs ${dark ? 'text-slate-500' : 'text-slate-400'}`}>Pilih semua</span>
                  )}
                </div>

                <div className="space-y-3">
                  {sudahCurrent.length === 0 && (
                    <p className={`text-sm ${dark ? 'text-slate-500 bg-slate-800 border-slate-700' : 'text-slate-400 bg-white border-slate-200'} text-center py-8 rounded-2xl border`}>Belum ada barang dibeli.</p>
                  )}
                  {sudahCurrent.map((barang) => (
                    <div key={barang.id} className={`${dark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} rounded-2xl shadow-sm border p-4`}>
                      <div className="flex items-center gap-3">
                        {renderSelectCheckbox(barang.id)}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium ${dark ? 'text-white' : 'text-slate-800'} truncate">{barang.nama_barang}</p>
                          <p className="text-sm font-semibold text-green-600">{formatRupiah(barang.harga_final)}</p>
                          {barang.updated_at && (
                            <p className="text-[10px] ${dark ? 'text-slate-500' : 'text-slate-400'} mt-0.5">
                              {new Intl.DateTimeFormat('id-ID', {
                                day: 'numeric', month: 'long', year: 'numeric',
                                hour: '2-digit', minute: '2-digit',
                              }).format(new Date(barang.updated_at))}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          {editingId === barang.id ? (
                            <div className="flex items-center gap-1.5">
                              <input
                                value={editForm.nama_barang}
                                onChange={(e) => setEditForm((f) => ({ ...f, nama_barang: e.target.value }))}
                                className={`w-24 border ${dark ? 'border-slate-600' : 'border-slate-200'} rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/30 ${dark ? 'bg-slate-700 text-white' : 'bg-slate-50 text-slate-800'}`}
                              />
                              <input
                                type="number"
                                value={editForm.harga_estimasi}
                                onChange={(e) => setEditForm((f) => ({ ...f, harga_estimasi: e.target.value }))}
                                className={`w-20 border ${dark ? 'border-slate-600' : 'border-slate-200'} rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/30 ${dark ? 'bg-slate-700 text-white' : 'bg-slate-50 text-slate-800'}`}
                                min="0"
                              />
                              <button onClick={() => saveEdit(barang.id)} className="text-green-600 text-xs font-semibold cursor-pointer">Simpan</button>
                              <button onClick={() => setEditingId(null)} className="text-slate-400 text-xs cursor-pointer">Batal</button>
                            </div>
                          ) : (
                            <>
                              <button onClick={() => startEdit(barang)} className={`${dark ? 'text-slate-500 hover:text-blue-400' : 'text-slate-400 hover:text-blue-600'} transition cursor-pointer`}>
                                <Pencil size={16} />
                              </button>
                              <button onClick={() => handleDelete(barang.id)} className={`${dark ? 'text-slate-500 hover:text-red-400' : 'text-slate-400 hover:text-red-500'} transition cursor-pointer`}>
                                <Trash2 size={16} />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <Pagination page={sudahPage} totalPages={sudahTotalPages} onChange={setSudahPage} dark={dark} />
              </section>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default App
