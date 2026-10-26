import { useEffect, useState, useRef } from 'react';
import api from '../api';

const API_HOST = 'http://localhost:8000';
const emptyForm = { name: '', imo_number: '', vessel_type: '' };

export default function Dashboard() {
  const [vessels, setVessels] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [err, setErr] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef(null);

  const load = async () => {
    try {
      const res = await api.get('/vessels');
      setVessels(res.data);
    } catch {
      setErr('Failed to load vessels');
    }
  };
  useEffect(() => { load(); }, []);

  // Clean up the preview URL when it changes or unmounts
  useEffect(() => {
    return () => { if (previewUrl) URL.revokeObjectURL(previewUrl); };
  }, [previewUrl]);

  const onFileChange = (e) => {
  const f = e.target.files?.[0];
  if (!f) return;
  if (!f.type.startsWith('image/')) {
    setErr('Please choose an image file');
    return;
  }
  if (f.size > 2 * 1024 * 1024) {
    setErr('Image must be under 2 MB');
    return;
  }
  setErr('');
  setFile(f);
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  setPreviewUrl(URL.createObjectURL(f));
};

  const clearFile = () => {
    setFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const add = async (e) => {
    e.preventDefault();
    setErr('');
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('name', form.name);
      fd.append('imo_number', form.imo_number);
      fd.append('vessel_type', form.vessel_type);
      if (file) fd.append('file', file);

      await api.post('/vessels', fd);
      setForm(emptyForm);
      clearFile();
      setShowForm(false);
      load();
    } catch (ex) {
      setErr(ex.response?.data?.detail || 'Failed to add vessel');
    } finally {
      setSubmitting(false);
    }
  };

  const del = async (id) => {
    if (!confirm('Delete this vessel?')) return;
    await api.delete(`/vessels/${id}`);
    load();
  };

  const cancelForm = () => {
    setShowForm(false);
    setForm(emptyForm);
    clearFile();
    setErr('');
  };

  // Resolve image URL — handle both new "/uploads/..." and legacy "https://..."
  const resolveImg = (url) => {
  if (!url) return '';
  if (url.startsWith('data:')) return url;    // base64 image — use as-is
  if (url.startsWith('http')) return url;     // external URL — use as-is
  return `${API_HOST}${url}`;                 // legacy /uploads/... — prepend host
};

  const uniqueTypes = new Set(vessels.map((v) => v.vessel_type).filter(Boolean)).size;
  const withPhotos = vessels.filter((v) => v.image_url).length;

  return (
    <div className="container">
      <div className="page-header">
        <h2>Fleet Dashboard</h2>
        <p>Manage the vessels registered to your account</p>
      </div>

      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-icon blue">🚢</div>
          <div>
            <div className="stat-label">Fleet Size</div>
            <div className="stat-value">{vessels.length}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green">📦</div>
          <div>
            <div className="stat-label">Vessel Types</div>
            <div className="stat-value">{uniqueTypes}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon orange">📸</div>
          <div>
            <div className="stat-label">With Photos</div>
            <div className="stat-value">{withPhotos}</div>
          </div>
        </div>
      </div>

      {!showForm && (
        <button
          className="btn"
          onClick={() => setShowForm(true)}
          style={{ marginBottom: 20 }}
        >
          + Add Vessel
        </button>
      )}

      {showForm && (
        <div className="card">
          <h3>New Vessel</h3>
          <p className="card-desc">Register a vessel to your fleet</p>
          <form onSubmit={add} style={{ display: 'grid', gap: 14 }}>
            <div className="grid-2">
              <div className="field">
                <label>Vessel Name</label>
                <input
                  placeholder="e.g. MV Samudra"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>
              <div className="field">
                <label>IMO Number (7 digits)</label>
                <input
                  placeholder="e.g. 9123456"
                  value={form.imo_number}
                  onChange={(e) => setForm({ ...form, imo_number: e.target.value })}
                  pattern="\d{7}"
                  title="7 digits"
                  required
                />
              </div>
            </div>

            <div className="field">
              <label>Vessel Type</label>
              <input
                placeholder="Cargo / Tanker / Bulk"
                value={form.vessel_type}
                onChange={(e) => setForm({ ...form, vessel_type: e.target.value })}
              />
            </div>

            {/* ====== PHOTO UPLOAD ====== */}
            <div className="field">
              <label>Vessel Photo</label>
              <div className="upload-row">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={onFileChange}
                  style={{ display: 'none' }}
                  id="vessel-photo-input"
                />
                <label htmlFor="vessel-photo-input" className="upload-btn">
                  📷 Choose Photo
                </label>
                {file && (
                  <button type="button" className="btn-secondary btn-sm" onClick={clearFile}>
                    Remove
                  </button>
                )}
                {!file && <span className="upload-hint">PNG, JPG, or WEBP — up to a few MB</span>}
              </div>

              {previewUrl && (
                <div className="upload-preview">
                  <img src={previewUrl} alt="Preview" />
                  <span className="upload-preview-name">{file?.name}</span>
                </div>
              )}
            </div>

            {err && <div className="error">{err}</div>}

            <div style={{ display: 'flex', gap: 8 }}>
              <button type="submit" className="btn" disabled={submitting}>
                {submitting ? 'Saving…' : 'Save Vessel'}
              </button>
              <button type="button" className="btn btn-secondary" onClick={cancelForm}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {vessels.length === 0 && !showForm && (
        <div className="empty-state">
          <span className="emoji">🚢</span>
          <h4>No vessels yet</h4>
          <p>Click "Add Vessel" above to register your first ship.</p>
        </div>
      )}

      {vessels.length > 0 && (
        <div className="vessel-grid">
          {vessels.map((v) => (
            <div key={v.id} className="vessel-card">
              <div className="vessel-image">
                {v.image_url ? (
                  <img
                    src={resolveImg(v.image_url)}
                    alt={v.name}
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                ) : (
                  '🚢'
                )}
                {v.vessel_type && (
                  <span className="vessel-type-badge">{v.vessel_type}</span>
                )}
              </div>
              <div className="vessel-body">
                <h4>{v.name}</h4>
                <div className="vessel-meta">
                  <div>IMO: <strong>{v.imo_number}</strong></div>
                  <div>Type: <strong>{v.vessel_type || 'Unspecified'}</strong></div>
                </div>
                <div className="vessel-actions">
                  <button className="btn btn-danger btn-sm" onClick={() => del(v.id)}>
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}