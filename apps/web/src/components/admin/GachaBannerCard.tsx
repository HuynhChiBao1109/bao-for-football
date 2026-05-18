import { useState } from 'react';
import { useCreateAdminGachaBanner } from '../../hooks/admin';
import { Banner } from '../feedback';
import type { AdminPlayer } from '../../types';

type Props = {
  token: string;
  players: AdminPlayer[];
  onCreated: () => void;
};

export function GachaBannerCard({ token, players, onCreated }: Props) {
  const createBannerMutation = useCreateAdminGachaBanner();
  const [playerId, setPlayerId] = useState<number>(0);
  const [timeEnd, setTimeEnd] = useState('');
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const selectedPlayer = players.find((player) => player.id === playerId) || null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg('');
    setErr('');

    try {
      if (!playerId) throw new Error('Vui lòng chọn cầu thủ');
      if (!timeEnd) throw new Error('Vui lòng chọn timeEnd');
      if (!bannerFile) throw new Error('Vui lòng chọn banner image');

      await createBannerMutation.mutateAsync({
        token,
        playerId,
        playerName: selectedPlayer?.name || 'Player',
        timeEnd,
        bannerFile,
      });

      setMsg('Đã tạo banner gacha thành công.');
      setPlayerId(0);
      setTimeEnd('');
      setBannerFile(null);
      if (bannerPreview) URL.revokeObjectURL(bannerPreview);
      setBannerPreview('');
      onCreated();
    } catch (error) {
      setErr((error as Error).message);
    }
  }

  return (
    <div className="game-panel game-panel--soft overflow-hidden p-5">
      <div className="game-panel__content">
        <p className="game-header-kicker">Gacha Admin</p>
        <h3 className="game-title mt-2 text-xl font-bold text-white">Tạo banner gacha</h3>
        <p className="mt-2 text-sm text-slate-400">
          Chọn cầu thủ, upload banner image và đặt thời gian hết hạn.
        </p>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <label className="block">
            <span className="game-field-label">Cầu thủ</span>
            <select
              value={String(playerId || '')}
              onChange={(e) => setPlayerId(Number(e.target.value))}
              className="game-input"
            >
              <option value="">Chọn cầu thủ</option>
              {players.map((player) => (
                <option key={player.id} value={player.id}>
                  {player.name} ({player.baseClub})
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="game-field-label">Time End</span>
            <input
              type="datetime-local"
              value={timeEnd}
              onChange={(e) => setTimeEnd(e.target.value)}
              className="game-input"
            />
          </label>

          <label className="block">
            <span className="game-field-label">Banner Image</span>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (bannerPreview) URL.revokeObjectURL(bannerPreview);
                setBannerFile(file);
                setBannerPreview(URL.createObjectURL(file));
              }}
              className="game-input"
            />
          </label>

          {bannerPreview && (
            <img
              src={bannerPreview}
              alt="banner preview"
              className="h-40 w-full rounded-2xl object-cover"
            />
          )}
          {msg && <Banner text={msg} tone="success" />}
          {err && <Banner text={err} tone="error" />}

          <button
            type="submit"
            disabled={createBannerMutation.isPending || !playerId || !timeEnd || !bannerFile}
            className="game-button-primary w-full"
          >
            {createBannerMutation.isPending ? 'Đang tạo...' : 'Tạo banner gacha'}
          </button>
        </form>
      </div>
    </div>
  );
}
