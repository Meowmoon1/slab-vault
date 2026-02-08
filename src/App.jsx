import { useState, useEffect, useMemo, useCallback, useRef } from "react";

// ─── Persistence Layer ───
const DB = {
  get: (key, fallback = []) => {
    try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch { return fallback; }
  },
  set: (key, val) => localStorage.setItem(key, JSON.stringify(val)),
};
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

// ─── Constants ───
const GRADING_COMPANIES = ["PSA", "BGS", "CGC"];
const GRADE_OPTIONS = {
  PSA: ["10","9","8","7","6","5","4","3","2","1","Auth"],
  BGS: ["10","9.5","9","8.5","8","7.5","7","6.5","6","5.5","5","4.5","4","3.5","3","2.5","2","1.5","1"],
  CGC: ["10","9.5","9","8.5","8","7.5","7","6.5","6","5.5","5","4.5","4","3.5","3","2.5","2","1.5","1"],
};
const BGS_SUBGRADES = ["Centering", "Corners", "Edges", "Surface"];
const ERAS = ["Vintage (WOTC)", "e-Series", "EX Era", "Diamond & Pearl", "HeartGold/SoulSilver", "Black & White", "XY", "Sun & Moon", "Sword & Shield", "Scarlet & Violet", "Modern JP", "Promo", "Custom"];
const STATUS_OPTIONS = ["In Collection", "Listed", "Sold", "Shipped"];
const LANGUAGES = ["English", "Japanese", "Korean", "Chinese", "French", "German", "Italian", "Spanish", "Portuguese", "Other"];

// ─── Utility Functions ───
const fmtCurrency = (n) => {
  if (n == null || isNaN(n)) return "$0.00";
  return "$" + Number(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};
const fmtPct = (n) => (n == null || isNaN(n) ? "0.0%" : (n * 100).toFixed(1) + "%");
const daysBetween = (a, b) => Math.max(1, Math.round((new Date(b) - new Date(a)) / 86400000));

function calcFlip(slab) {
  const buy = parseFloat(slab.buyPrice) || 0;
  const sell = parseFloat(slab.sellPrice) || 0;
  const platformPct = parseFloat(slab.platformFee) || 0;
  const fixedFee = parseFloat(slab.fixedFee) || 0;
  const shipping = parseFloat(slab.shippingCost) || 0;
  const platformFeeAmt = sell * (platformPct / 100);
  const totalFees = platformFeeAmt + fixedFee + shipping;
  const netProfit = sell - buy - totalFees;
  const roi = buy > 0 ? netProfit / buy : 0;
  const today = new Date().toISOString().split("T")[0];
  const buyDate = slab.buyDate || today;
  const isSold = slab.status === "Sold" || slab.status === "Shipped";
  const sellDate = isSold && slab.sellDate ? slab.sellDate : today;
  const daysHeld = daysBetween(buyDate, sellDate);
  const annualized = daysHeld > 0 && roi > -1 ? Math.pow(1 + roi, 365 / daysHeld) - 1 : 0;
  return { netProfit, roi, annualized, totalFees, platformFeeAmt, daysHeld };
}

const fmtDays = (d) => {
  if (d <= 0) return "0d";
  if (d < 30) return `${d}d`;
  if (d < 365) return `${Math.floor(d / 30)}mo ${d % 30}d`;
  return `${Math.floor(d / 365)}y ${Math.floor((d % 365) / 30)}mo`;
};

// ─── Icons ───
const Icons = {
  slabs: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18M3 9h18"/></svg>,
  flip: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4"/></svg>,
  dashboard: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
  analytics: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>,
  plus: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>,
  edit: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  trash: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>,
  search: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>,
  camera: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>,
  x: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>,
  chevron: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>,
  star: <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>,
  download: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>,
  eye: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
};

// ─── Image Handler ───
function readFileAsDataURL(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.readAsDataURL(file);
  });
}

// ─── Style Constants ───
const C = {
  bg: "#0a0a0f",
  surface: "#12121a",
  surface2: "#1a1a26",
  surface3: "#222233",
  border: "#2a2a3d",
  borderLight: "#3a3a55",
  text: "#e8e6f0",
  textMuted: "#8888a8",
  textDim: "#5a5a78",
  accent: "#d4af37",
  accentDim: "#a8882a",
  accentGlow: "rgba(212,175,55,0.15)",
  green: "#22c55e",
  greenDim: "rgba(34,197,94,0.12)",
  red: "#ef4444",
  redDim: "rgba(239,68,68,0.12)",
  blue: "#3b82f6",
  blueDim: "rgba(59,130,246,0.12)",
  purple: "#a855f7",
  purpleDim: "rgba(168,85,247,0.12)",
};

// ─── Main App ───
export default function SlabFlipperApp() {
  const [tab, setTab] = useState("slabs");
  const [slabs, setSlabs] = useState(() => DB.get("slabs", []));
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [viewId, setViewId] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCompany, setFilterCompany] = useState("All");
  const [filterStatus, setFilterStatus] = useState("All");
  const [filterEra, setFilterEra] = useState("All");
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { DB.set("slabs", slabs); }, [slabs]);

  const saveSlab = useCallback((slab) => {
    if (editId) {
      setSlabs((prev) => prev.map((s) => (s.id === editId ? { ...slab, id: editId } : s)));
    } else {
      setSlabs((prev) => [...prev, { ...slab, id: uid() }]);
    }
    setShowForm(false);
    setEditId(null);
  }, [editId]);

  const deleteSlab = useCallback((id) => {
    setSlabs((prev) => prev.filter((s) => s.id !== id));
    setViewId(null);
  }, []);

  const openEdit = useCallback((id) => {
    setEditId(id);
    setShowForm(true);
    setViewId(null);
  }, []);

  const filtered = useMemo(() => {
    return slabs.filter((s) => {
      const matchSearch = !searchTerm || [s.cardName, s.set, s.tags, s.notes, s.certNumber].join(" ").toLowerCase().includes(searchTerm.toLowerCase());
      const matchCompany = filterCompany === "All" || s.gradingCompany === filterCompany;
      const matchStatus = filterStatus === "All" || s.status === filterStatus;
      const matchEra = filterEra === "All" || s.era === filterEra;
      return matchSearch && matchCompany && matchStatus && matchEra;
    });
  }, [slabs, searchTerm, filterCompany, filterStatus, filterEra]);

  const tabStyle = (t) => ({
    padding: "10px 18px",
    background: tab === t ? C.accent : "transparent",
    color: tab === t ? "#0a0a0f" : C.textMuted,
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    fontWeight: tab === t ? 700 : 500,
    fontSize: "13px",
    display: "flex",
    alignItems: "center",
    gap: "7px",
    transition: "all 0.2s",
    letterSpacing: "0.02em",
    fontFamily: "inherit",
  });

  return (
    <div style={{
      minHeight: "100vh",
      background: C.bg,
      color: C.text,
      fontFamily: "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace",
      opacity: mounted ? 1 : 0,
      transition: "opacity 0.5s",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600;700&family=Playfair+Display:wght@400;600;700;800&display=swap" rel="stylesheet" />

      {/* Header */}
      <header style={{
        background: `linear-gradient(180deg, ${C.surface} 0%, ${C.bg} 100%)`,
        borderBottom: `1px solid ${C.border}`,
        padding: "20px 0 0",
        position: "sticky",
        top: 0,
        zIndex: 100,
        backdropFilter: "blur(20px)",
      }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 10,
                background: `linear-gradient(135deg, ${C.accent}, ${C.accentDim})`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 20, boxShadow: `0 4px 20px ${C.accentGlow}`,
              }}>◆</div>
              <div>
                <h1 style={{
                  margin: 0, fontSize: 22, fontWeight: 700,
                  fontFamily: "'Playfair Display', Georgia, serif",
                  background: `linear-gradient(135deg, ${C.accent}, #f5e6a3)`,
                  WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                  letterSpacing: "-0.01em",
                }}>Slab Vault</h1>
                <p style={{ margin: 0, fontSize: 11, color: C.textDim, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                  Pokémon Slab Flipper
                </p>
              </div>
            </div>
            <div style={{ fontSize: 11, color: C.textDim, textAlign: "right" }}>
              <span style={{ color: C.accent }}>{slabs.length}</span> slabs tracked
            </div>
          </div>
          <nav style={{ display: "flex", gap: 4, paddingBottom: 0 }}>
            {[
              ["slabs", "Slabs", Icons.slabs],
              ["flips", "Flips", Icons.flip],
              ["dashboard", "Dashboard", Icons.dashboard],
              ["analytics", "Analytics", Icons.analytics],
            ].map(([key, label, icon]) => (
              <button key={key} onClick={() => { setTab(key); setShowForm(false); setViewId(null); }} style={tabStyle(key)}>
                {icon}{label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* Content */}
      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 24px 80px" }}>
        {showForm && (
          <SlabForm
            slab={editId ? slabs.find((s) => s.id === editId) : null}
            onSave={saveSlab}
            onCancel={() => { setShowForm(false); setEditId(null); }}
          />
        )}
        {viewId && !showForm && (
          <SlabDetail
            slab={slabs.find((s) => s.id === viewId)}
            onClose={() => setViewId(null)}
            onEdit={() => openEdit(viewId)}
            onDelete={() => deleteSlab(viewId)}
          />
        )}
        {!showForm && !viewId && tab === "slabs" && (
          <SlabList
            slabs={filtered}
            searchTerm={searchTerm}
            onSearch={setSearchTerm}
            filterCompany={filterCompany}
            onFilterCompany={setFilterCompany}
            filterStatus={filterStatus}
            onFilterStatus={setFilterStatus}
            filterEra={filterEra}
            onFilterEra={setFilterEra}
            onAdd={() => { setEditId(null); setShowForm(true); }}
            onView={setViewId}
            onEdit={openEdit}
            onDelete={deleteSlab}
          />
        )}
        {!showForm && !viewId && tab === "flips" && <FlipTracker slabs={slabs} onView={setViewId} />}
        {!showForm && !viewId && tab === "dashboard" && <Dashboard slabs={slabs} />}
        {!showForm && !viewId && tab === "analytics" && <Analytics slabs={slabs} onView={setViewId} />}
      </main>
    </div>
  );
}

// ─── Shared Components ───
function Card({ children, style, onClick }) {
  return (
    <div onClick={onClick} style={{
      background: C.surface,
      border: `1px solid ${C.border}`,
      borderRadius: 12,
      padding: 20,
      ...style,
      cursor: onClick ? "pointer" : undefined,
      transition: "border-color 0.2s, transform 0.15s",
    }}
    onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.borderLight; if(onClick) e.currentTarget.style.transform = "translateY(-1px)"; }}
    onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.transform = "none"; }}
    >{children}</div>
  );
}

function Btn({ children, variant = "primary", style, ...props }) {
  const styles = {
    primary: { background: C.accent, color: "#0a0a0f", fontWeight: 700 },
    secondary: { background: C.surface2, color: C.text, border: `1px solid ${C.border}` },
    danger: { background: C.redDim, color: C.red },
    ghost: { background: "transparent", color: C.textMuted },
  };
  return (
    <button {...props} style={{
      padding: "8px 16px", borderRadius: 8, border: "none", cursor: "pointer",
      fontSize: 12, fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 6,
      transition: "all 0.2s", letterSpacing: "0.02em",
      ...styles[variant], ...style,
    }}>{children}</button>
  );
}

function Input({ label, ...props }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {label && <label style={{ fontSize: 11, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</label>}
      <input {...props} style={{
        background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 8,
        padding: "10px 12px", color: C.text, fontSize: 13, fontFamily: "inherit",
        outline: "none", transition: "border-color 0.2s",
        ...props.style,
      }}
      onFocus={(e) => e.target.style.borderColor = C.accent}
      onBlur={(e) => e.target.style.borderColor = C.border}
      />
    </div>
  );
}

function Select({ label, options, ...props }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {label && <label style={{ fontSize: 11, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</label>}
      <select {...props} style={{
        background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 8,
        padding: "10px 12px", color: C.text, fontSize: 13, fontFamily: "inherit",
        outline: "none", cursor: "pointer", ...props.style,
      }}>
        {options.map((o) => <option key={typeof o === "string" ? o : o.value} value={typeof o === "string" ? o : o.value}>{typeof o === "string" ? o : o.label}</option>)}
      </select>
    </div>
  );
}

function Badge({ children, color = C.accent, bg }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", padding: "3px 8px",
      borderRadius: 6, fontSize: 10, fontWeight: 600,
      color, background: bg || `${color}18`, letterSpacing: "0.04em",
    }}>{children}</span>
  );
}

function StatCard({ label, value, sub, color = C.accent, icon }) {
  return (
    <Card style={{ padding: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 11, color: C.textDim, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>{label}</div>
          <div style={{ fontSize: 24, fontWeight: 700, color, fontFamily: "'Playfair Display', serif" }}>{value}</div>
          {sub && <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>{sub}</div>}
        </div>
        {icon && <div style={{ color: C.textDim, opacity: 0.5 }}>{icon}</div>}
      </div>
    </Card>
  );
}

function EmptyState({ icon, title, subtitle, action }) {
  return (
    <div style={{ textAlign: "center", padding: "60px 20px" }}>
      <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.3 }}>{icon}</div>
      <h3 style={{ fontSize: 16, fontWeight: 600, color: C.textMuted, margin: "0 0 8px" }}>{title}</h3>
      <p style={{ fontSize: 13, color: C.textDim, margin: "0 0 20px" }}>{subtitle}</p>
      {action}
    </div>
  );
}

// ─── Image Uploader ───
function ImageUploader({ label, value, onChange }) {
  const ref = useRef();
  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert("Image must be under 5MB"); return; }
    const data = await readFileAsDataURL(file);
    onChange(data);
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={{ fontSize: 11, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</label>
      <div
        onClick={() => ref.current?.click()}
        style={{
          width: "100%", height: 140, borderRadius: 10,
          border: `2px dashed ${value ? C.accent : C.border}`,
          background: value ? "transparent" : C.surface2,
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", overflow: "hidden", position: "relative",
          transition: "border-color 0.2s",
        }}
      >
        {value ? (
          <>
            <img src={value} alt={label} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
            <button onClick={(e) => { e.stopPropagation(); onChange(null); }} style={{
              position: "absolute", top: 6, right: 6, background: "rgba(0,0,0,0.7)",
              border: "none", borderRadius: 6, width: 24, height: 24,
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", color: C.red,
            }}>{Icons.x}</button>
          </>
        ) : (
          <div style={{ textAlign: "center", color: C.textDim }}>
            {Icons.camera}
            <div style={{ fontSize: 10, marginTop: 6 }}>Click to upload</div>
          </div>
        )}
      </div>
      <input ref={ref} type="file" accept="image/*" onChange={handleFile} style={{ display: "none" }} />
    </div>
  );
}

// ─── Slab Form ───
function SlabForm({ slab, onSave, onCancel }) {
  const [form, setForm] = useState({
    cardName: "", set: "", year: "", language: "English",
    gradingCompany: "PSA", grade: "10", certNumber: "",
    subCentering: "", subCorners: "", subEdges: "", subSurface: "",
    population: "", notes: "", tags: "", era: ERAS[0],
    status: "In Collection",
    buyPrice: "", buyDate: new Date().toISOString().split("T")[0],
    sellPrice: "", sellDate: "",
    platformFee: "", fixedFee: "", shippingCost: "",
    frontImage: null, backImage: null,
    ...(slab || {}),
  });

  const update = (k, v) => setForm((p) => ({ ...p, [k]: v }));
  const showSubs = form.gradingCompany === "BGS";

  return (
    <Card style={{ marginBottom: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontFamily: "'Playfair Display', serif", color: C.accent }}>
          {slab ? "Edit Slab" : "Add New Slab"}
        </h2>
        <button onClick={onCancel} style={{ background: "none", border: "none", cursor: "pointer", color: C.textMuted, padding: 4 }}>{Icons.x}</button>
      </div>

      {/* Card Info */}
      <SectionLabel>Card Information</SectionLabel>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
        <Input label="Card Name *" value={form.cardName} onChange={(e) => update("cardName", e.target.value)} placeholder="e.g. Charizard VMAX" style={{ gridColumn: "1/-1" }} />
        <Input label="Set" value={form.set} onChange={(e) => update("set", e.target.value)} placeholder="e.g. Shining Fates" />
        <Input label="Year" value={form.year} onChange={(e) => update("year", e.target.value)} placeholder="e.g. 2021" />
        <Select label="Language" options={LANGUAGES} value={form.language} onChange={(e) => update("language", e.target.value)} />
        <Select label="Era" options={ERAS} value={form.era} onChange={(e) => update("era", e.target.value)} />
      </div>

      {/* Grading */}
      <SectionLabel>Grading Details</SectionLabel>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12, marginBottom: showSubs ? 12 : 16 }}>
        <Select label="Company" options={GRADING_COMPANIES} value={form.gradingCompany} onChange={(e) => update("gradingCompany", e.target.value)} />
        <Select label="Grade" options={GRADE_OPTIONS[form.gradingCompany] || []} value={form.grade} onChange={(e) => update("grade", e.target.value)} />
        <Input label="Cert / Serial #" value={form.certNumber} onChange={(e) => update("certNumber", e.target.value)} placeholder="e.g. 12345678" />
        <Input label="Population" value={form.population} onChange={(e) => update("population", e.target.value)} placeholder="e.g. 1,250" />
      </div>
      {showSubs && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
          {BGS_SUBGRADES.map((sg) => (
            <Input key={sg} label={sg} value={form[`sub${sg}`]} onChange={(e) => update(`sub${sg}`, e.target.value)} placeholder="0-10" />
          ))}
        </div>
      )}

      {/* Financials */}
      <SectionLabel>Financials</SectionLabel>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
        <Input label="Buy Price ($)" type="number" step="0.01" value={form.buyPrice} onChange={(e) => update("buyPrice", e.target.value)} />
        <Input label="Buy Date" type="date" value={form.buyDate} onChange={(e) => update("buyDate", e.target.value)} />
        <Input label="Expected / Sell Price ($)" type="number" step="0.01" value={form.sellPrice} onChange={(e) => update("sellPrice", e.target.value)} />
        <Input label="Sell Date" type="date" value={form.sellDate} onChange={(e) => update("sellDate", e.target.value)} />
        <Input label="Platform Fee (%)" type="number" step="0.1" value={form.platformFee} onChange={(e) => update("platformFee", e.target.value)} placeholder="e.g. 13.25" />
        <Input label="Fixed Fee ($)" type="number" step="0.01" value={form.fixedFee} onChange={(e) => update("fixedFee", e.target.value)} placeholder="e.g. 0.40" />
        <Input label="Shipping ($)" type="number" step="0.01" value={form.shippingCost} onChange={(e) => update("shippingCost", e.target.value)} placeholder="e.g. 5.00" />
        <Select label="Status" options={STATUS_OPTIONS} value={form.status} onChange={(e) => update("status", e.target.value)} />
      </div>

      {/* Images */}
      <SectionLabel>Images</SectionLabel>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
        <ImageUploader label="Front" value={form.frontImage} onChange={(v) => update("frontImage", v)} />
        <ImageUploader label="Back" value={form.backImage} onChange={(v) => update("backImage", v)} />
      </div>

      {/* Notes */}
      <SectionLabel>Notes & Tags</SectionLabel>
      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12, marginBottom: 20 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ fontSize: 11, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.08em" }}>Notes</label>
          <textarea value={form.notes} onChange={(e) => update("notes", e.target.value)} placeholder="Any notes about this slab..." rows={3} style={{
            background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 8,
            padding: "10px 12px", color: C.text, fontSize: 13, fontFamily: "inherit",
            outline: "none", resize: "vertical",
          }} />
        </div>
        <Input label="Tags (comma-separated)" value={form.tags} onChange={(e) => update("tags", e.target.value)} placeholder="e.g. grail, alt-art, investment" />
      </div>

      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
        <Btn variant="secondary" onClick={onCancel}>Cancel</Btn>
        <Btn onClick={() => { if (!form.cardName.trim()) { alert("Card name is required"); return; } onSave(form); }}>
          {slab ? "Save Changes" : "Add Slab"}
        </Btn>
      </div>
    </Card>
  );
}

function SectionLabel({ children }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 600, color: C.accent, textTransform: "uppercase",
      letterSpacing: "0.12em", marginBottom: 10, paddingBottom: 6,
      borderBottom: `1px solid ${C.border}`,
    }}>{children}</div>
  );
}

// ─── Slab Detail View ───
function SlabDetail({ slab, onClose, onEdit, onDelete }) {
  if (!slab) return null;
  const flip = calcFlip(slab);
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <Card style={{ marginBottom: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontFamily: "'Playfair Display', serif" }}>{slab.cardName}</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <Btn variant="secondary" onClick={onEdit}>{Icons.edit} Edit</Btn>
          {!confirmDelete ? (
            <Btn variant="danger" onClick={() => setConfirmDelete(true)}>{Icons.trash} Delete</Btn>
          ) : (
            <Btn variant="danger" onClick={onDelete}>Confirm Delete</Btn>
          )}
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: C.textMuted }}>{Icons.x}</button>
        </div>
      </div>

      {/* Images */}
      {(slab.frontImage || slab.backImage) && (
        <div style={{ display: "flex", gap: 16, marginBottom: 20, justifyContent: "center", flexWrap: "wrap" }}>
          {slab.frontImage && <img src={slab.frontImage} alt="Front" style={{ maxHeight: 280, borderRadius: 10, border: `1px solid ${C.border}` }} />}
          {slab.backImage && <img src={slab.backImage} alt="Back" style={{ maxHeight: 280, borderRadius: 10, border: `1px solid ${C.border}` }} />}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 20 }}>
        <DetailField label="Set" value={slab.set || "—"} />
        <DetailField label="Year" value={slab.year || "—"} />
        <DetailField label="Language" value={slab.language} />
        <DetailField label="Era" value={slab.era} />
        <DetailField label="Grade" value={<Badge color={gradeColor(slab.gradingCompany)}>{slab.gradingCompany} {slab.grade}</Badge>} />
        <DetailField label="Cert #" value={slab.certNumber || "—"} />
        <DetailField label="Population" value={slab.population || "—"} />
        <DetailField label="Status" value={<Badge color={statusColor(slab.status)}>{slab.status}</Badge>} />
        <DetailField label="Buy Price" value={fmtCurrency(slab.buyPrice)} />
        <DetailField label="Sell Price" value={slab.sellPrice ? fmtCurrency(slab.sellPrice) : "—"} />
        <DetailField label="Holding Period" value={
          <span style={{ color: C.accent, fontWeight: 600 }}>{fmtDays(flip.daysHeld)}</span>
        } />
        <DetailField label="Buy Date" value={slab.buyDate || "—"} />
      </div>

      {slab.gradingCompany === "BGS" && (slab.subCentering || slab.subCorners || slab.subEdges || slab.subSurface) && (
        <div style={{ marginBottom: 20 }}>
          <SectionLabel>BGS Subgrades</SectionLabel>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12 }}>
            {BGS_SUBGRADES.map((sg) => (
              <DetailField key={sg} label={sg} value={slab[`sub${sg}`] || "—"} />
            ))}
          </div>
        </div>
      )}

      {/* Flip Calc */}
      <SectionLabel>Flip Analysis</SectionLabel>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr", gap: 12 }}>
        <DetailField label="Total Fees" value={fmtCurrency(flip.totalFees)} />
        <DetailField label="Net Profit" value={
          <span style={{ color: flip.netProfit >= 0 ? C.green : C.red, fontWeight: 600 }}>
            {fmtCurrency(flip.netProfit)}
          </span>
        } />
        <DetailField label="ROI" value={
          <span style={{ color: flip.roi >= 0 ? C.green : C.red, fontWeight: 600 }}>
            {fmtPct(flip.roi)}
          </span>
        } />
        <DetailField label="Annualized" value={
          <span style={{ color: flip.annualized >= 0 ? C.green : C.red, fontWeight: 600 }}>
            {fmtPct(flip.annualized)}
          </span>
        } />
        <DetailField label="Days Held" value={
          <span style={{ color: C.accent, fontWeight: 600 }}>{flip.daysHeld}d</span>
        } />
      </div>

      {slab.notes && (
        <div style={{ marginTop: 16 }}>
          <SectionLabel>Notes</SectionLabel>
          <p style={{ fontSize: 13, color: C.textMuted, margin: 0, lineHeight: 1.6 }}>{slab.notes}</p>
        </div>
      )}
      {slab.tags && (
        <div style={{ marginTop: 12, display: "flex", gap: 6, flexWrap: "wrap" }}>
          {slab.tags.split(",").map((t) => t.trim()).filter(Boolean).map((t) => (
            <Badge key={t} color={C.purple} bg={C.purpleDim}>{t}</Badge>
          ))}
        </div>
      )}
    </Card>
  );
}

function DetailField({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: C.textDim, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 14, color: C.text }}>{value}</div>
    </div>
  );
}

function gradeColor(company) {
  if (company === "PSA") return "#ef4444";
  if (company === "BGS") return "#3b82f6";
  if (company === "CGC") return "#22c55e";
  return C.accent;
}

function statusColor(s) {
  if (s === "Sold" || s === "Shipped") return C.green;
  if (s === "Listed") return C.blue;
  return C.textMuted;
}

// ─── Slab List ───
function SlabList({ slabs, searchTerm, onSearch, filterCompany, onFilterCompany, filterStatus, onFilterStatus, filterEra, onFilterEra, onAdd, onView, onEdit, onDelete }) {
  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
          <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: C.textDim }}>{Icons.search}</span>
          <input value={searchTerm} onChange={(e) => onSearch(e.target.value)} placeholder="Search slabs..." style={{
            width: "100%", boxSizing: "border-box", padding: "10px 12px 10px 38px",
            background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8,
            color: C.text, fontSize: 13, fontFamily: "inherit", outline: "none",
          }} />
        </div>
        <select value={filterCompany} onChange={(e) => onFilterCompany(e.target.value)} style={{
          background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8,
          padding: "10px 12px", color: C.text, fontSize: 12, fontFamily: "inherit", cursor: "pointer",
        }}>
          <option value="All">All Graders</option>
          {GRADING_COMPANIES.map((c) => <option key={c}>{c}</option>)}
        </select>
        <select value={filterStatus} onChange={(e) => onFilterStatus(e.target.value)} style={{
          background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8,
          padding: "10px 12px", color: C.text, fontSize: 12, fontFamily: "inherit", cursor: "pointer",
        }}>
          <option value="All">All Status</option>
          {STATUS_OPTIONS.map((s) => <option key={s}>{s}</option>)}
        </select>
        <select value={filterEra} onChange={(e) => onFilterEra(e.target.value)} style={{
          background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8,
          padding: "10px 12px", color: C.text, fontSize: 12, fontFamily: "inherit", cursor: "pointer",
        }}>
          <option value="All">All Eras</option>
          {ERAS.map((e) => <option key={e}>{e}</option>)}
        </select>
        <Btn onClick={onAdd}>{Icons.plus} Add Slab</Btn>
      </div>

      {slabs.length === 0 ? (
        <EmptyState
          icon="◆"
          title="No slabs yet"
          subtitle="Start building your vault by adding your first slab."
          action={<Btn onClick={onAdd}>{Icons.plus} Add Your First Slab</Btn>}
        />
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {/* Table header */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "2.5fr 1.2fr 0.8fr 1fr 1fr 0.8fr 0.8fr 0.5fr",
            gap: 12, padding: "8px 16px", fontSize: 10, color: C.textDim,
            textTransform: "uppercase", letterSpacing: "0.1em",
          }}>
            <span>Card</span><span>Grade</span><span>Era</span><span>Buy</span><span>Sell</span><span>Profit</span><span>Held</span><span></span>
          </div>
          {slabs.map((s) => {
            const flip = calcFlip(s);
            return (
              <div key={s.id} onClick={() => onView(s.id)} style={{
                display: "grid",
                gridTemplateColumns: "2.5fr 1.2fr 0.8fr 1fr 1fr 0.8fr 0.8fr 0.5fr",
                gap: 12, padding: "14px 16px", background: C.surface,
                border: `1px solid ${C.border}`, borderRadius: 10,
                alignItems: "center", cursor: "pointer", transition: "border-color 0.2s",
                fontSize: 13,
              }}
              onMouseEnter={(e) => e.currentTarget.style.borderColor = C.borderLight}
              onMouseLeave={(e) => e.currentTarget.style.borderColor = C.border}
              >
                <div>
                  <div style={{ fontWeight: 600, marginBottom: 2 }}>{s.cardName}</div>
                  <div style={{ fontSize: 11, color: C.textDim }}>{s.set} {s.year && `(${s.year})`}{s.certNumber ? ` · #${s.certNumber}` : ""}</div>
                </div>
                <div><Badge color={gradeColor(s.gradingCompany)}>{s.gradingCompany} {s.grade}</Badge></div>
                <div style={{ fontSize: 11, color: C.textMuted }}>{s.era?.split("(")[0]?.trim().slice(0,10)}</div>
                <div>{fmtCurrency(s.buyPrice)}</div>
                <div>{s.sellPrice ? fmtCurrency(s.sellPrice) : "—"}</div>
                <div style={{ color: flip.netProfit >= 0 ? C.green : C.red, fontWeight: 600 }}>
                  {fmtCurrency(flip.netProfit)}
                </div>
                <div style={{ fontSize: 11, color: C.textMuted }}>{fmtDays(flip.daysHeld)}</div>
                <div style={{ display: "flex", gap: 4 }}>
                  <button onClick={(e) => { e.stopPropagation(); onEdit(s.id); }} style={{
                    background: "none", border: "none", cursor: "pointer", color: C.textMuted, padding: 4,
                  }}>{Icons.edit}</button>
                  <button onClick={(e) => { e.stopPropagation(); if (confirm("Delete this slab?")) onDelete(s.id); }} style={{
                    background: "none", border: "none", cursor: "pointer", color: C.textDim, padding: 4,
                  }}>{Icons.trash}</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Flip Tracker Tab ───
function FlipTracker({ slabs, onView }) {
  const sorted = useMemo(() =>
    [...slabs].sort((a, b) => (new Date(b.buyDate || 0)) - (new Date(a.buyDate || 0))),
  [slabs]);

  const sold = sorted.filter((s) => s.status === "Sold" || s.status === "Shipped");
  const active = sorted.filter((s) => s.status !== "Sold" && s.status !== "Shipped");

  return (
    <div>
      <h2 style={{ fontSize: 20, fontFamily: "'Playfair Display', serif", color: C.accent, marginBottom: 20 }}>Flip Tracker</h2>

      {slabs.length === 0 ? (
        <EmptyState icon="📊" title="No flips to track" subtitle="Add slabs to start tracking your flips." />
      ) : (
        <>
          {/* Active Flips */}
          <h3 style={{ fontSize: 13, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>
            Active Positions ({active.length})
          </h3>
          {active.length === 0 ? (
            <p style={{ fontSize: 13, color: C.textDim, marginBottom: 24 }}>No active positions.</p>
          ) : (
            <div style={{ display: "grid", gap: 8, marginBottom: 28 }}>
              {active.map((s) => <FlipRow key={s.id} slab={s} onView={onView} />)}
            </div>
          )}

          {/* Completed Flips */}
          <h3 style={{ fontSize: 13, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>
            Completed Flips ({sold.length})
          </h3>
          {sold.length === 0 ? (
            <p style={{ fontSize: 13, color: C.textDim }}>No completed flips yet.</p>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {sold.map((s) => <FlipRow key={s.id} slab={s} onView={onView} />)}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function FlipRow({ slab, onView }) {
  const flip = calcFlip(slab);
  return (
    <Card onClick={() => onView(slab.id)} style={{ padding: 14, cursor: "pointer" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div style={{ minWidth: 180 }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{slab.cardName}</div>
          <div style={{ fontSize: 11, color: C.textDim, marginTop: 2 }}>
            {slab.gradingCompany} {slab.grade} · {slab.set}
          </div>
        </div>
        <div style={{ display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap" }}>
          <MiniStat label="Cost" value={fmtCurrency(slab.buyPrice)} />
          <MiniStat label="Sell" value={slab.sellPrice ? fmtCurrency(slab.sellPrice) : "—"} />
          <MiniStat label="Fees" value={fmtCurrency(flip.totalFees)} />
          <MiniStat label="Net" value={fmtCurrency(flip.netProfit)} color={flip.netProfit >= 0 ? C.green : C.red} />
          <MiniStat label="ROI" value={fmtPct(flip.roi)} color={flip.roi >= 0 ? C.green : C.red} />
          <MiniStat label="Held" value={fmtDays(flip.daysHeld)} color={C.accent} />
          <Badge color={statusColor(slab.status)}>{slab.status}</Badge>
        </div>
      </div>
    </Card>
  );
}

function MiniStat({ label, value, color }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 10, color: C.textDim, textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: color || C.text, marginTop: 2 }}>{value}</div>
    </div>
  );
}

// ─── Dashboard ───
function Dashboard({ slabs }) {
  const stats = useMemo(() => {
    const sold = slabs.filter((s) => s.status === "Sold" || s.status === "Shipped");
    const active = slabs.filter((s) => s.status !== "Sold" && s.status !== "Shipped");

    const totalCapital = slabs.reduce((sum, s) => sum + (parseFloat(s.buyPrice) || 0), 0);
    const activeCapital = active.reduce((sum, s) => sum + (parseFloat(s.buyPrice) || 0), 0);

    const realizedPnl = sold.reduce((sum, s) => sum + calcFlip(s).netProfit, 0);
    const unrealizedPnl = active.reduce((sum, s) => sum + calcFlip(s).netProfit, 0);

    // Holding period stats
    const soldFlips = sold.map((s) => ({ ...s, flip: calcFlip(s) }));
    const activeFlips = active.map((s) => ({ ...s, flip: calcFlip(s) }));
    const avgHoldSold = soldFlips.length > 0 ? Math.round(soldFlips.reduce((s, x) => s + x.flip.daysHeld, 0) / soldFlips.length) : 0;
    const avgHoldActive = activeFlips.length > 0 ? Math.round(activeFlips.reduce((s, x) => s + x.flip.daysHeld, 0) / activeFlips.length) : 0;
    const longestHold = [...soldFlips, ...activeFlips].sort((a, b) => b.flip.daysHeld - a.flip.daysHeld)[0];
    const totalDaysCapitalDeployed = activeFlips.reduce((s, x) => s + x.flip.daysHeld * (parseFloat(x.buyPrice) || 0), 0);
    const weightedAvgHold = activeCapital > 0 ? Math.round(totalDaysCapitalDeployed / activeCapital) : 0;

    // Inventory value summary (active slabs: winners vs losers based on expected sell vs buy)
    const inventoryItems = activeFlips.map((s) => {
      const buy = parseFloat(s.buyPrice) || 0;
      const expectedSell = parseFloat(s.sellPrice) || 0;
      const expectedProfit = s.flip.netProfit;
      const pctChange = buy > 0 ? expectedProfit / buy : 0;
      return { ...s, expectedProfit, pctChange };
    });
    const winners = inventoryItems.filter((s) => s.expectedProfit > 0).sort((a, b) => b.expectedProfit - a.expectedProfit);
    const losers = inventoryItems.filter((s) => s.expectedProfit < 0).sort((a, b) => a.expectedProfit - b.expectedProfit);
    const totalInventoryValue = active.reduce((sum, s) => sum + (parseFloat(s.sellPrice) || parseFloat(s.buyPrice) || 0), 0);

    // By grading company
    const byCompany = {};
    GRADING_COMPANIES.forEach((c) => {
      const cs = slabs.filter((s) => s.gradingCompany === c);
      const soldC = cs.filter((s) => s.status === "Sold" || s.status === "Shipped");
      byCompany[c] = {
        count: cs.length,
        capital: cs.reduce((sum, s) => sum + (parseFloat(s.buyPrice) || 0), 0),
        pnl: soldC.reduce((sum, s) => sum + calcFlip(s).netProfit, 0),
      };
    });

    // By era
    const byEra = {};
    slabs.forEach((s) => {
      const era = s.era || "Unknown";
      if (!byEra[era]) byEra[era] = { count: 0, capital: 0, pnl: 0 };
      byEra[era].count++;
      byEra[era].capital += parseFloat(s.buyPrice) || 0;
      if (s.status === "Sold" || s.status === "Shipped") {
        byEra[era].pnl += calcFlip(s).netProfit;
      }
    });

    return { totalCapital, activeCapital, realizedPnl, unrealizedPnl, sold: sold.length, active: active.length, byCompany, byEra, avgHoldSold, avgHoldActive, longestHold, weightedAvgHold, winners, losers, totalInventoryValue };
  }, [slabs]);

  if (slabs.length === 0) {
    return <EmptyState icon="📈" title="No data yet" subtitle="Add slabs to see your portfolio dashboard." />;
  }

  return (
    <div>
      <h2 style={{ fontSize: 20, fontFamily: "'Playfair Display', serif", color: C.accent, marginBottom: 20 }}>Portfolio Dashboard</h2>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, marginBottom: 28 }}>
        <StatCard label="Total Capital Deployed" value={fmtCurrency(stats.totalCapital)} sub={`${slabs.length} total slabs`} color={C.accent} />
        <StatCard label="Active Capital" value={fmtCurrency(stats.activeCapital)} sub={`${stats.active} positions`} color={C.blue} />
        <StatCard label="Realized PnL" value={fmtCurrency(stats.realizedPnl)} sub={`${stats.sold} completed flips`} color={stats.realizedPnl >= 0 ? C.green : C.red} />
        <StatCard label="Unrealized PnL" value={fmtCurrency(stats.unrealizedPnl)} sub="Based on expected sell" color={stats.unrealizedPnl >= 0 ? C.green : C.red} />
        <StatCard label="Inventory Value" value={fmtCurrency(stats.totalInventoryValue)} sub={`${stats.active} active slabs`} color={C.purple} />
      </div>

      {/* Holding Period Stats */}
      <h3 style={{ fontSize: 13, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>
        Capital Velocity
      </h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 28 }}>
        <StatCard label="Avg Hold (Sold)" value={fmtDays(stats.avgHoldSold)} sub="Completed flips" color={C.green} />
        <StatCard label="Avg Hold (Active)" value={fmtDays(stats.avgHoldActive)} sub="Current positions" color={C.blue} />
        <StatCard label="Weighted Avg Hold" value={fmtDays(stats.weightedAvgHold)} sub="By capital deployed" color={C.accent} />
        {stats.longestHold && (
          <StatCard label="Longest Hold" value={fmtDays(stats.longestHold.flip.daysHeld)} sub={stats.longestHold.cardName} color={C.red} />
        )}
      </div>

      {/* Inventory Value Summary - Winners & Losers */}
      {(stats.winners.length > 0 || stats.losers.length > 0) && (
        <>
          <h3 style={{ fontSize: 13, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>
            Inventory Value Summary
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 28 }}>
            {/* Winners */}
            <Card style={{ padding: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.green, marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 14 }}>▲</span> Winners ({stats.winners.length})
              </div>
              {stats.winners.length === 0 ? (
                <div style={{ fontSize: 12, color: C.textDim }}>No winning positions yet</div>
              ) : (
                <div style={{ display: "grid", gap: 6 }}>
                  {stats.winners.slice(0, 6).map((s) => (
                    <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, padding: "6px 0", borderBottom: `1px solid ${C.border}` }}>
                      <div>
                        <div style={{ fontWeight: 600, marginBottom: 1 }}>{s.cardName}</div>
                        <div style={{ fontSize: 10, color: C.textDim }}>{s.gradingCompany} {s.grade} · {fmtDays(s.flip.daysHeld)}</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ color: C.green, fontWeight: 600 }}>{fmtCurrency(s.expectedProfit)}</div>
                        <div style={{ fontSize: 10, color: C.green }}>{fmtPct(s.pctChange)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
            {/* Losers */}
            <Card style={{ padding: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.red, marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 14 }}>▼</span> Losers ({stats.losers.length})
              </div>
              {stats.losers.length === 0 ? (
                <div style={{ fontSize: 12, color: C.textDim }}>No losing positions</div>
              ) : (
                <div style={{ display: "grid", gap: 6 }}>
                  {stats.losers.slice(0, 6).map((s) => (
                    <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, padding: "6px 0", borderBottom: `1px solid ${C.border}` }}>
                      <div>
                        <div style={{ fontWeight: 600, marginBottom: 1 }}>{s.cardName}</div>
                        <div style={{ fontSize: 10, color: C.textDim }}>{s.gradingCompany} {s.grade} · {fmtDays(s.flip.daysHeld)}</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ color: C.red, fontWeight: 600 }}>{fmtCurrency(s.expectedProfit)}</div>
                        <div style={{ fontSize: 10, color: C.red }}>{fmtPct(s.pctChange)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </>
      )}

      {/* By Company */}
      <h3 style={{ fontSize: 13, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>
        By Grading Company
      </h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 28 }}>
        {GRADING_COMPANIES.map((c) => {
          const d = stats.byCompany[c];
          if (!d || d.count === 0) return (
            <Card key={c} style={{ padding: 16, opacity: 0.4 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: gradeColor(c), marginBottom: 8 }}>{c}</div>
              <div style={{ fontSize: 12, color: C.textDim }}>No slabs</div>
            </Card>
          );
          return (
            <Card key={c} style={{ padding: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: gradeColor(c), marginBottom: 8 }}>{c}</div>
              <div style={{ display: "grid", gap: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                  <span style={{ color: C.textDim }}>Slabs</span><span>{d.count}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                  <span style={{ color: C.textDim }}>Capital</span><span>{fmtCurrency(d.capital)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                  <span style={{ color: C.textDim }}>Realized PnL</span>
                  <span style={{ color: d.pnl >= 0 ? C.green : C.red }}>{fmtCurrency(d.pnl)}</span>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* By Era */}
      <h3 style={{ fontSize: 13, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>
        By Era
      </h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
        {Object.entries(stats.byEra).sort((a, b) => b[1].capital - a[1].capital).map(([era, d]) => (
          <Card key={era} style={{ padding: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.accent, marginBottom: 6 }}>{era}</div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}>
              <span style={{ color: C.textDim }}>Slabs</span><span>{d.count}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}>
              <span style={{ color: C.textDim }}>Capital</span><span>{fmtCurrency(d.capital)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
              <span style={{ color: C.textDim }}>PnL</span>
              <span style={{ color: d.pnl >= 0 ? C.green : C.red }}>{fmtCurrency(d.pnl)}</span>
            </div>
            {/* Mini bar */}
            {stats.totalCapital > 0 && (
              <div style={{ marginTop: 8, height: 3, borderRadius: 2, background: C.surface2 }}>
                <div style={{
                  height: "100%", borderRadius: 2,
                  background: C.accent,
                  width: `${Math.min(100, (d.capital / stats.totalCapital) * 100)}%`,
                }} />
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}

// ─── Analytics Tab ───
function Analytics({ slabs, onView }) {
  const analytics = useMemo(() => {
    const sold = slabs.filter((s) => s.status === "Sold" || s.status === "Shipped").map((s) => ({ ...s, flip: calcFlip(s) }));

    const sortedByProfit = [...sold].sort((a, b) => b.flip.netProfit - a.flip.netProfit);
    const sortedByROI = [...sold].sort((a, b) => b.flip.roi - a.flip.roi);
    const sortedByLoss = [...sold].sort((a, b) => a.flip.netProfit - b.flip.netProfit);

    const totalRevenue = sold.reduce((s, x) => s + (parseFloat(x.sellPrice) || 0), 0);
    const totalCost = sold.reduce((s, x) => s + (parseFloat(x.buyPrice) || 0), 0);
    const totalFees = sold.reduce((s, x) => s + x.flip.totalFees, 0);
    const totalProfit = sold.reduce((s, x) => s + x.flip.netProfit, 0);
    const avgROI = sold.length > 0 ? sold.reduce((s, x) => s + x.flip.roi, 0) / sold.length : 0;
    const winRate = sold.length > 0 ? sold.filter((x) => x.flip.netProfit > 0).length / sold.length : 0;
    const avgHoldTime = sold.length > 0 ? Math.round(sold.reduce((s, x) => s + x.flip.daysHeld, 0) / sold.length) : 0;
    const fastestFlip = sold.length > 0 ? [...sold].sort((a, b) => a.flip.daysHeld - b.flip.daysHeld)[0] : null;
    const profitPerDay = sold.length > 0 ? totalProfit / sold.reduce((s, x) => s + x.flip.daysHeld, 0) : 0;

    // Monthly breakdown
    const monthly = {};
    sold.forEach((s) => {
      const month = (s.sellDate || s.buyDate || "").slice(0, 7);
      if (!month) return;
      if (!monthly[month]) monthly[month] = { revenue: 0, profit: 0, count: 0 };
      monthly[month].revenue += parseFloat(s.sellPrice) || 0;
      monthly[month].profit += s.flip.netProfit;
      monthly[month].count++;
    });

    return { sold, sortedByProfit, sortedByROI, sortedByLoss, totalRevenue, totalCost, totalFees, totalProfit, avgROI, winRate, monthly, avgHoldTime, fastestFlip, profitPerDay };
  }, [slabs]);

  if (slabs.length === 0) {
    return <EmptyState icon="🔍" title="No analytics yet" subtitle="Add and sell slabs to see analytics." />;
  }

  return (
    <div>
      <h2 style={{ fontSize: 20, fontFamily: "'Playfair Display', serif", color: C.accent, marginBottom: 20 }}>Analytics</h2>

      {/* Summary Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 28 }}>
        <StatCard label="Total Revenue" value={fmtCurrency(analytics.totalRevenue)} color={C.blue} />
        <StatCard label="Total Profit" value={fmtCurrency(analytics.totalProfit)} color={analytics.totalProfit >= 0 ? C.green : C.red} />
        <StatCard label="Total Fees Paid" value={fmtCurrency(analytics.totalFees)} color={C.red} />
        <StatCard label="Average ROI" value={fmtPct(analytics.avgROI)} color={analytics.avgROI >= 0 ? C.green : C.red} />
        <StatCard label="Win Rate" value={fmtPct(analytics.winRate)} color={analytics.winRate >= 0.5 ? C.green : C.red} />
        <StatCard label="Flips Completed" value={analytics.sold.length} color={C.accent} />
        <StatCard label="Avg Flip Time" value={fmtDays(analytics.avgHoldTime)} color={C.blue} />
        <StatCard label="Profit / Day" value={fmtCurrency(analytics.profitPerDay)} sub="Across all flip days" color={analytics.profitPerDay >= 0 ? C.green : C.red} />
        {analytics.fastestFlip && (
          <StatCard label="Fastest Flip" value={fmtDays(analytics.fastestFlip.flip.daysHeld)} sub={analytics.fastestFlip.cardName} color={C.accent} />
        )}
      </div>

      {/* Top Performers */}
      {analytics.sortedByProfit.length > 0 && (
        <>
          <h3 style={{ fontSize: 13, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
            {Icons.star} Highest Profit Flips
          </h3>
          <div style={{ display: "grid", gap: 8, marginBottom: 28 }}>
            {analytics.sortedByProfit.slice(0, 5).map((s, i) => (
              <Card key={s.id} onClick={() => onView(s.id)} style={{ padding: 14, cursor: "pointer" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{
                      width: 28, height: 28, borderRadius: 8,
                      background: i === 0 ? C.accentGlow : C.surface2,
                      color: i === 0 ? C.accent : C.textMuted,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 12, fontWeight: 700,
                    }}>#{i + 1}</span>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{s.cardName}</div>
                      <div style={{ fontSize: 11, color: C.textDim }}>{s.gradingCompany} {s.grade} · {s.set}</div>
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ color: C.green, fontWeight: 700, fontSize: 16 }}>{fmtCurrency(s.flip.netProfit)}</div>
                    <div style={{ fontSize: 11, color: C.textDim }}>{fmtPct(s.flip.roi)} ROI · {fmtDays(s.flip.daysHeld)}</div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Best ROI */}
      {analytics.sortedByROI.length > 0 && (
        <>
          <h3 style={{ fontSize: 13, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>
            Best ROI Flips
          </h3>
          <div style={{ display: "grid", gap: 8, marginBottom: 28 }}>
            {analytics.sortedByROI.slice(0, 5).map((s, i) => (
              <Card key={s.id} onClick={() => onView(s.id)} style={{ padding: 14, cursor: "pointer" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{
                      width: 28, height: 28, borderRadius: 8,
                      background: i === 0 ? C.greenDim : C.surface2,
                      color: i === 0 ? C.green : C.textMuted,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 12, fontWeight: 700,
                    }}>#{i + 1}</span>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{s.cardName}</div>
                      <div style={{ fontSize: 11, color: C.textDim }}>{fmtCurrency(s.buyPrice)} → {fmtCurrency(s.sellPrice)}</div>
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ color: C.green, fontWeight: 700, fontSize: 16 }}>{fmtPct(s.flip.roi)}</div>
                    <div style={{ fontSize: 11, color: C.textDim }}>{fmtCurrency(s.flip.netProfit)} profit</div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Worst Flips */}
      {analytics.sortedByLoss.filter((s) => s.flip.netProfit < 0).length > 0 && (
        <>
          <h3 style={{ fontSize: 13, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>
            Biggest Losses
          </h3>
          <div style={{ display: "grid", gap: 8, marginBottom: 28 }}>
            {analytics.sortedByLoss.filter((s) => s.flip.netProfit < 0).slice(0, 5).map((s, i) => (
              <Card key={s.id} onClick={() => onView(s.id)} style={{ padding: 14, cursor: "pointer" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{
                      width: 28, height: 28, borderRadius: 8,
                      background: C.redDim, color: C.red,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 12, fontWeight: 700,
                    }}>#{i + 1}</span>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{s.cardName}</div>
                      <div style={{ fontSize: 11, color: C.textDim }}>{s.gradingCompany} {s.grade} · {s.set}</div>
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ color: C.red, fontWeight: 700, fontSize: 16 }}>{fmtCurrency(s.flip.netProfit)}</div>
                    <div style={{ fontSize: 11, color: C.textDim }}>{fmtPct(s.flip.roi)} ROI</div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Monthly Breakdown */}
      {Object.keys(analytics.monthly).length > 0 && (
        <>
          <h3 style={{ fontSize: 13, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>
            Monthly Performance
          </h3>
          <div style={{ display: "grid", gap: 6 }}>
            <div style={{
              display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr",
              gap: 12, padding: "8px 16px", fontSize: 10, color: C.textDim,
              textTransform: "uppercase", letterSpacing: "0.1em",
            }}>
              <span>Month</span><span>Flips</span><span>Revenue</span><span>Profit</span>
            </div>
            {Object.entries(analytics.monthly).sort((a, b) => b[0].localeCompare(a[0])).map(([month, d]) => (
              <div key={month} style={{
                display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr",
                gap: 12, padding: "12px 16px", background: C.surface,
                border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 13,
              }}>
                <span style={{ fontWeight: 600 }}>{month}</span>
                <span>{d.count}</span>
                <span>{fmtCurrency(d.revenue)}</span>
                <span style={{ color: d.profit >= 0 ? C.green : C.red, fontWeight: 600 }}>{fmtCurrency(d.profit)}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
