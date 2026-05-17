import { useEffect, useMemo, useRef, useState } from "react";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8081";
const DEFAULT_AVATAR_URL = "/default-avatar.svg";

const statFields = [
  { key: "shooting", label: "Dứt điểm" },
  { key: "passing", label: "Chuyền ngắn" },
  { key: "longPass", label: "Chuyền dài" },
  { key: "vision", label: "Tầm nhìn" },
  { key: "gkReach", label: "GK Reach" },
  { key: "counterAttackAwareness", label: "Nhận thức phản công" },
  { key: "gkParrying", label: "GK Parrying" },
  { key: "gkReflex", label: "GK Reflex" },
  { key: "gkCatching", label: "GK Catching" },
  { key: "duels", label: "Tranh chấp" },
  { key: "pace", label: "Tốc độ" },
  { key: "physical", label: "Thể chất" },
  { key: "defending", label: "Phòng ngự" },
  { key: "standingTackle", label: "Tắc bóng" },
  { key: "slidingTackle", label: "Xoạc bóng" },
  { key: "dribbling", label: "Rê bóng" },
];

function buildInitialDraft({ season, sourceType, countries }) {
  return {
    name: "",
    countryId: countries[0]?.id ? String(countries[0].id) : "",
    baseClub: "",
    season,
    sourceType,
    specialSkill: "",
    shooting: 60,
    passing: 60,
    longPass: 60,
    vision: 60,
    gkReach: 60,
    counterAttackAwareness: 60,
    gkParrying: 60,
    gkReflex: 60,
    gkCatching: 60,
    duels: 60,
    pace: 60,
    physical: 60,
    defending: 60,
    standingTackle: 60,
    slidingTackle: 60,
    dribbling: 60,
  };
}

function AdminPlayerCreateCard({
  token,
  title,
  subtitle,
  season,
  sourceType,
  countries,
  clubsRefreshToken = 0,
  onCreated,
  onUnauthorized,
}) {
  const [form, setForm] = useState(() =>
    buildInitialDraft({ season, sourceType, countries }),
  );
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState("");
  const [clubs, setClubs] = useState([]);
  const [clubsLoading, setClubsLoading] = useState(false);
  const [clubsError, setClubsError] = useState("");
  const [clubsOpen, setClubsOpen] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);

  const selectedCountryName = useMemo(() => {
    return (
      countries.find((item) => String(item.id) === String(form.countryId))
        ?.name || ""
    );
  }, [countries, form.countryId]);

  useEffect(() => {
    let active = true;

    async function loadClubs() {
      setClubsLoading(true);
      setClubsError("");

      try {
        const response = await fetch(`${API_BASE_URL}/api/v1/auth/clubs`);
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data?.error || "Không thể tải danh sách CLB");
        }

        if (active) {
          setClubs(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        if (active) {
          setClubsError(err.message);
        }
      } finally {
        if (active) {
          setClubsLoading(false);
        }
      }
    }

    loadClubs();

    return () => {
      active = false;
    };
  }, [clubsRefreshToken]);

  useEffect(() => {
    if (!form.baseClub && clubs.length > 0) {
      setForm((current) => ({
        ...current,
        baseClub: clubs[0].name,
      }));
    }
  }, [clubs, form.baseClub]);

  useEffect(() => {
    if (!form.countryId && countries.length > 0) {
      setForm((current) => ({
        ...current,
        countryId: String(countries[0].id),
      }));
    }
  }, [countries, form.countryId]);

  const selectedClub = useMemo(() => {
    return clubs.find((item) => item.name === form.baseClub) || null;
  }, [clubs, form.baseClub]);

  useEffect(() => {
    return () => {
      if (avatarPreview) {
        URL.revokeObjectURL(avatarPreview);
      }
    };
  }, [avatarPreview]);

  function updateField(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function applyAvatarFile(file) {
    if (avatarPreview) {
      URL.revokeObjectURL(avatarPreview);
    }

    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function handleAvatarChange(event) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    applyAvatarFile(file);
  }

  function openFilePicker() {
    fileInputRef.current?.click();
  }

  function selectClub(club) {
    setForm((current) => ({
      ...current,
      baseClub: club.name,
    }));
    setClubsOpen(false);
  }

  function handleDragOver(event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setDragActive(true);
  }

  function handleDragEnter(event) {
    event.preventDefault();
    setDragActive(true);
  }

  function handleDragLeave(event) {
    event.preventDefault();
    if (event.currentTarget === event.target) {
      setDragActive(false);
    }
  }

  function handleDrop(event) {
    event.preventDefault();
    setDragActive(false);

    const file = event.dataTransfer.files?.[0];
    if (!file) {
      return;
    }

    applyAvatarFile(file);
  }

  function clearAvatar() {
    if (avatarPreview) {
      URL.revokeObjectURL(avatarPreview);
    }
    setAvatarFile(null);
    setAvatarPreview("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");

    try {
      const formData = new FormData();
      formData.append("name", form.name);
      formData.append("countryId", String(Number(form.countryId)));
      formData.append("baseClub", form.baseClub);
      formData.append("season", season);
      formData.append("sourceType", sourceType);
      formData.append("specialSkill", form.specialSkill);
      formData.append("shooting", String(Number(form.shooting)));
      formData.append("passing", String(Number(form.passing)));
      formData.append("longPass", String(Number(form.longPass)));
      formData.append("vision", String(Number(form.vision)));
      formData.append("gkReach", String(Number(form.gkReach)));
      formData.append(
        "counterAttackAwareness",
        String(Number(form.counterAttackAwareness)),
      );
      formData.append("gkParrying", String(Number(form.gkParrying)));
      formData.append("gkReflex", String(Number(form.gkReflex)));
      formData.append("gkCatching", String(Number(form.gkCatching)));
      formData.append("duels", String(Number(form.duels)));
      formData.append("pace", String(Number(form.pace)));
      formData.append("physical", String(Number(form.physical)));
      formData.append("defending", String(Number(form.defending)));
      formData.append("standingTackle", String(Number(form.standingTackle)));
      formData.append("slidingTackle", String(Number(form.slidingTackle)));
      formData.append("dribbling", String(Number(form.dribbling)));
      if (avatarFile) {
        formData.append("avatar", avatarFile);
      }

      const response = await fetch(`${API_BASE_URL}/api/v1/admin/players`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });
      const data = await response.json();
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          onUnauthorized();
          return;
        }
        throw new Error(data?.error || "Không thể tạo cầu thủ");
      }

      setMessage("Đã tạo cầu thủ thành công.");
      setForm(buildInitialDraft({ season, sourceType, countries }));
      clearAvatar();
      if (typeof onCreated === "function") {
        onCreated();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="game-panel overflow-hidden p-5">
      <p className="game-header-kicker">{title}</p>
      <h2 className="game-title mt-3 text-3xl font-bold text-white">
        {subtitle}
      </h2>
      <div className="mt-3 flex flex-wrap gap-2 text-xs uppercase tracking-[0.22em] text-slate-300">
        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
          Season: {season}
        </span>
        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
          Source: {sourceType}
        </span>
        {selectedCountryName && (
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
            Country: {selectedCountryName}
          </span>
        )}
      </div>

      <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
        <div className="grid gap-3 md:grid-cols-2">
          <Field
            label="Name"
            value={form.name}
            onChange={(value) => updateField("name", value)}
          />
          <SelectField
            label="Country"
            value={form.countryId}
            options={countries.map((country) => ({
              value: String(country.id),
              label: country.name,
            }))}
            onChange={(value) => updateField("countryId", value)}
          />
          <Field
            label="Special Skill"
            value={form.specialSkill}
            onChange={(value) => updateField("specialSkill", value)}
          />
          <ClubSelect
            label="Base Club"
            club={selectedClub}
            clubs={clubs}
            open={clubsOpen}
            loading={clubsLoading}
            error={clubsError}
            onToggle={() => setClubsOpen((current) => !current)}
            onSelect={selectClub}
          />
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {statFields.map((field) => (
            <Field
              key={field.key}
              label={field.label}
              type="number"
              value={form[field.key]}
              onChange={(value) => updateField(field.key, value)}
            />
          ))}
        </div>

        <div
          className={`rounded-3xl border border-dashed p-4 transition ${
            dragActive
              ? "border-cyan-300 bg-cyan-500/10"
              : "border-white/15 bg-white/5"
          }`}
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={openFilePicker}
          role="button"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              openFilePicker();
            }
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleAvatarChange}
            className="hidden"
          />
          <div className="grid gap-4 md:grid-cols-[120px_1fr] md:items-center">
            <img
              src={avatarPreview || DEFAULT_AVATAR_URL}
              alt="Avatar preview"
              className="h-28 w-28 rounded-2xl object-cover"
            />
            <div className="space-y-3">
              <div>
                <p className="game-field-label">Avatar Upload</p>
                <p className="mt-1 text-sm leading-6 text-slate-300">
                  Kéo thả ảnh vào đây hoặc bấm để chọn file. Nếu không upload,
                  player sẽ lưu với avatar null và FE tự render ảnh mặc định.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    openFilePicker();
                  }}
                  className="game-button-primary"
                >
                  Chọn ảnh
                </button>
                {avatarFile && (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      clearAvatar();
                    }}
                    className="rounded-full border border-white/15 px-4 py-2 text-sm text-slate-200 transition hover:bg-white/5"
                  >
                    Xoá ảnh
                  </button>
                )}
              </div>
              {avatarFile && (
                <p className="text-xs text-slate-400">{avatarFile.name}</p>
              )}
            </div>
          </div>
        </div>

        {message && (
          <p className="game-notice game-notice--success">{message}</p>
        )}
        {error && <p className="game-notice game-notice--error">{error}</p>}

        <button
          type="submit"
          disabled={
            loading ||
            !form.name.trim() ||
            !form.baseClub.trim() ||
            !form.countryId
          }
          className="game-button-primary w-full"
        >
          {loading ? "Đang tạo..." : "Tạo cầu thủ"}
        </button>
      </form>
    </section>
  );
}

function Field({ label, value, onChange, type = "text" }) {
  return (
    <label className="block">
      <span className="game-field-label">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="game-input"
      />
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

function ClubSelect({
  label,
  club,
  clubs,
  open,
  loading,
  error,
  onToggle,
  onSelect,
}) {
  return (
    <div className="relative block">
      <span className="game-field-label">{label}</span>
      <button
        type="button"
        onClick={onToggle}
        className="game-input flex min-h-[56px] w-full items-center gap-3 text-left"
      >
        <img
          src={club?.logo || "/default-avatar.svg"}
          alt={club?.name || "Club preview"}
          className="h-10 w-10 rounded-xl bg-white/10 object-contain p-1"
        />
        <span className="flex-1 text-sm text-white">
          {club?.name || (loading ? "Đang tải CLB..." : "Chọn CLB")}
        </span>
        <span className="text-xs uppercase tracking-[0.2em] text-slate-400">
          {open ? "Close" : "Open"}
        </span>
      </button>
      {open && (
        <div className="absolute z-20 mt-2 max-h-72 w-full overflow-auto rounded-3xl border border-white/10 bg-[#0f1730] p-2 shadow-[0_26px_50px_-24px_rgba(0,0,0,0.85)]">
          {error && (
            <p className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
              {error}
            </p>
          )}
          {!error && clubs.length === 0 && !loading && (
            <p className="px-3 py-4 text-sm text-slate-400">
              Không có CLB nào để chọn.
            </p>
          )}
          <div className="grid gap-2">
            {clubs.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelect(item)}
                className={`flex items-center gap-3 rounded-2xl border px-3 py-2 text-left transition ${
                  club?.id === item.id
                    ? "border-cyan-300/50 bg-cyan-500/10"
                    : "border-white/10 bg-white/5 hover:bg-white/10"
                }`}
              >
                <img
                  src={item.logo || "/default-avatar.svg"}
                  alt={item.name}
                  className="h-10 w-10 rounded-xl bg-white/10 object-contain p-1"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-white">
                    {item.name}
                  </p>
                  <p className="truncate text-xs text-slate-400">
                    {item.leagueName}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminPlayerCreateCard;
