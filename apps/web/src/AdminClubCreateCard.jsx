import { useEffect, useMemo, useState } from "react";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8081";

function AdminClubCreateCard({ token, countries, onCreated, onUnauthorized }) {
  const [form, setForm] = useState({
    name: "",
    logo: "",
    countryId: "",
    budget: 0,
    leagueName: "",
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!form.countryId && countries.length > 0) {
      setForm((current) => ({
        ...current,
        countryId: String(countries[0].id),
      }));
    }
  }, [countries, form.countryId]);

  const selectedCountry = useMemo(() => {
    return countries.find((item) => String(item.id) === String(form.countryId));
  }, [countries, form.countryId]);

  function updateField(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");

    try {
      const payload = {
        ...form,
        countryId: Number(form.countryId),
        budget: Number(form.budget),
      };

      const response = await fetch(`${API_BASE_URL}/api/v1/admin/clubs`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          onUnauthorized();
          return;
        }
        throw new Error(data?.error || "Không thể tạo club");
      }

      setMessage("Đã tạo club thành công.");
      setForm({
        name: "",
        logo: "",
        countryId: countries[0]?.id ? String(countries[0].id) : "",
        budget: 0,
        leagueName: "",
      });
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
      <p className="game-header-kicker">Admin Club</p>
      <h2 className="game-title mt-3 text-3xl font-bold text-white">
        Tạo club
      </h2>
      <p className="mt-2 text-sm text-slate-400">
        Tạo club mới để dùng cho base club, registration và gắn với quốc gia.
      </p>

      <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
        <Field
          label="Name"
          value={form.name}
          onChange={(value) => updateField("name", value)}
        />
        <Field
          label="Logo URL"
          value={form.logo}
          onChange={(value) => updateField("logo", value)}
          helper="Link ảnh logo club"
        />
        <SelectField
          label="Country"
          value={form.countryId}
          options={countries.map((country) => ({
            value: String(country.id),
            label: `${country.name}${country.code ? ` (${country.code})` : ""}`,
          }))}
          onChange={(value) => updateField("countryId", value)}
        />
        <Field
          label="Budget"
          type="number"
          value={form.budget}
          onChange={(value) => updateField("budget", value)}
          helper={selectedCountry ? `Country: ${selectedCountry.name}` : ""}
        />
        <Field
          label="League Name"
          value={form.leagueName}
          onChange={(value) => updateField("leagueName", value)}
        />

        {message && (
          <p className="game-notice game-notice--success">{message}</p>
        )}
        {error && <p className="game-notice game-notice--error">{error}</p>}

        <button
          type="submit"
          disabled={
            loading ||
            !form.name.trim() ||
            !form.countryId ||
            !form.leagueName.trim()
          }
          className="game-button-primary w-full"
        >
          {loading ? "Đang tạo..." : "Tạo club"}
        </button>
      </form>
    </section>
  );
}

function Field({ label, value, onChange, type = "text", helper }) {
  return (
    <label className="block">
      <span className="game-field-label">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="game-input"
      />
      {helper && <p className="mt-1 text-xs text-slate-400">{helper}</p>}
    </label>
  );
}

function SelectField({ label, value, options, onChange }) {
  return (
    <label className="block">
      <span className="game-field-label">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="game-select"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export default AdminClubCreateCard;
