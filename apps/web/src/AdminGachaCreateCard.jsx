import { useMemo, useState } from "react";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8081";

function AdminGachaCreateCard({ token, players, onUnauthorized }) {
  const [gachaForm, setGachaForm] = useState({
    playerId: 0,
    timeEnd: "",
  });
  const [bannerFile, setBannerFile] = useState(null);
  const [bannerPreview, setBannerPreview] = useState("");
  const [loadingCreateGacha, setLoadingCreateGacha] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const selectedPlayer = useMemo(() => {
    return players.find((player) => String(player.id) === String(gachaForm.playerId)) || null;
  }, [gachaForm.playerId, players]);

  function handleBannerFileChange(event) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (bannerPreview) {
      URL.revokeObjectURL(bannerPreview);
    }

    setBannerFile(file);
    setBannerPreview(URL.createObjectURL(file));
  }

  async function uploadBannerImage() {
    if (!bannerFile) {
      return "";
    }

    const formData = new FormData();
    formData.append("image", bannerFile);

    const response = await fetch(`${API_BASE_URL}/api/v1/admin/uploads/image`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.error || "Không thể upload banner");
    }

    return data?.data?.url || "";
  }

  async function submitCreateGacha(event) {
    event.preventDefault();
    setLoadingCreateGacha(true);
    setMessage("");
    setError("");

    try {
      const uploadedImageUrl = await uploadBannerImage();
      const expiresAt = new Date(gachaForm.timeEnd);
      if (Number.isNaN(expiresAt.getTime())) {
        throw new Error("timeEnd không hợp lệ");
      }

      const safePlayerName = selectedPlayer?.name || `player-${gachaForm.playerId}`;
      const bannerCode = `gacha-${gachaForm.playerId}-${Date.now()}`;
      const bannerName = `${safePlayerName} Banner`;

      const response = await fetch(
        `${API_BASE_URL}/api/v1/admin/gacha/banners`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            bannerCode,
            bannerName,
            playerId: Number(gachaForm.playerId),
            bannerImageUrl: uploadedImageUrl,
            timeEnd: expiresAt.toISOString(),
          }),
        },
      );
      const data = await response.json();
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          onUnauthorized();
          return;
        }
        throw new Error(data?.error || "Failed to create gacha banner");
      }

      setMessage("Đã tạo banner gacha thành công (1 cầu thủ).");
      setGachaForm((current) => ({
        ...current,
        playerId: 0,
        timeEnd: "",
      }));
      setBannerFile(null);
      if (bannerPreview) {
        URL.revokeObjectURL(bannerPreview);
      }
      setBannerPreview("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingCreateGacha(false);
    }
  }

  return (
    <section className="game-panel overflow-hidden p-5">
      <p className="game-header-kicker">Create Gacha</p>
      <h2 className="game-title mt-3 text-3xl font-bold text-white">
        Tạo banner gacha
      </h2>
      <p className="mt-2 text-sm text-slate-300">
        Chọn cầu thủ, upload banner image và đặt thời gian hết hạn.
      </p>

      <form className="mt-4 space-y-3" onSubmit={submitCreateGacha}>
        <Select
          label="Player"
          value={String(gachaForm.playerId || "")}
          options={players.map((player) => ({
            value: String(player.id),
            label: `${player.name} (${player.baseClub})`,
          }))}
          onChange={(value) =>
            setGachaForm((current) => ({
              ...current,
              playerId: Number(value),
            }))
          }
        />

        <label className="block">
          <span className="game-field-label">Time End</span>
          <input
            type="datetime-local"
            value={gachaForm.timeEnd}
            onChange={(event) =>
              setGachaForm((current) => ({
                ...current,
                timeEnd: event.target.value,
              }))
            }
            className="game-input"
          />
        </label>

        <label className="block">
          <span className="game-field-label">Banner Image Upload</span>
          <input
            type="file"
            accept="image/*"
            onChange={handleBannerFileChange}
            className="game-input"
          />
        </label>

        {bannerPreview && (
          <img
            src={bannerPreview}
            alt="Banner preview"
            className="h-28 w-full rounded-xl object-cover"
          />
        )}

        {message && (
          <p className="game-notice game-notice--success">{message}</p>
        )}
        {error && <p className="game-notice game-notice--error">{error}</p>}

        <button
          type="submit"
          disabled={
            loadingCreateGacha ||
            !gachaForm.playerId ||
            !gachaForm.timeEnd ||
            !bannerFile
          }
          className="game-button-primary w-full"
        >
          {loadingCreateGacha ? "Đang tạo..." : "Tạo banner gacha"}
        </button>
      </form>
    </section>
  );
}

function Input({ label, value, onChange }) {
  return (
    <label className="block">
      <span className="game-field-label">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="game-input"
      />
    </label>
  );
}

function Select({ label, value, options, onChange }) {
  return (
    <label className="block">
      <span className="game-field-label">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="game-select"
      >
        {options.map((option) => (
          <option key={option.value || option} value={option.value || option}>
            {option.label || option}
          </option>
        ))}
      </select>
    </label>
  );
}

export default AdminGachaCreateCard;
