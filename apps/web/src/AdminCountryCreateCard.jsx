import { useState } from "react";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8081";

function AdminCountryCreateCard({ token, onCreated, onUnauthorized }) {
  const [form, setForm] = useState({
    name: "",
    code: "",
    flag: "",
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function updateField(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/admin/countries`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          onUnauthorized();
          return;
        }
        throw new Error(data?.error || "Không thể tạo quốc gia");
      }

      setMessage("Đã tạo quốc gia thành công.");
      setForm({ name: "", code: "", flag: "" });
      if (typeof onCreated === "function") {
        onCreated(data?.data);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="game-panel overflow-hidden p-5">
      <p className="game-header-kicker">Admin Country</p>
      <h2 className="game-title mt-3 text-3xl font-bold text-white">
        Tạo quốc gia
      </h2>
      <p className="mt-2 text-sm text-slate-400">
        Thêm quốc gia mới để dùng cho player, club và các form admin khác.
      </p>

      <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
        <Field
          label="Name"
          value={form.name}
          onChange={(value) => updateField("name", value)}
        />
        <Field
          label="Code"
          value={form.code}
          onChange={(value) => updateField("code", value)}
          helper="Ví dụ: GB-ENG, VN, JP"
        />
        <Field
          label="Flag URL"
          value={form.flag}
          onChange={(value) => updateField("flag", value)}
          helper="Link ảnh cờ quốc gia"
        />

        {message && (
          <p className="game-notice game-notice--success">{message}</p>
        )}
        {error && <p className="game-notice game-notice--error">{error}</p>}

        <button
          type="submit"
          disabled={loading || !form.name.trim()}
          className="game-button-primary w-full"
        >
          {loading ? "Đang tạo..." : "Tạo quốc gia"}
        </button>
      </form>
    </section>
  );
}

function Field({ label, value, onChange, helper }) {
  return (
    <label className="block">
      <span className="game-field-label">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="game-input"
      />
      {helper && <p className="mt-1 text-xs text-slate-400">{helper}</p>}
    </label>
  );
}

export default AdminCountryCreateCard;
