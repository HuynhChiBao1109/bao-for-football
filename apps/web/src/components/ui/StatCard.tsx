type Props = {
  label: string;
  value: string | number;
  hint?: string;
};

export function StatCard({ label, value, hint }: Props) {
  return (
    <div className="game-stat-card">
      <p className="game-stat-card__label">{label}</p>
      <p className="game-stat-card__value">{value}</p>
      {hint && <p className="game-stat-card__hint">{hint}</p>}
    </div>
  );
}

export function InfoTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-[18px] border border-white/8 bg-black/20 px-4 py-3 flex items-center justify-between gap-3">
      <span className="text-slate-400 text-sm">{label}</span>
      <strong className="text-white">{value}</strong>
    </div>
  );
}
