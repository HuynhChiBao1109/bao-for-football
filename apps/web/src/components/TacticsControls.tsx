import {
  MENTALITY_OPTIONS,
  PLAY_STYLE_OPTIONS,
} from '../lib/tactics';
import type { Tactics, TacticsMentality, TacticsPlayStyle } from '../types';

type TacticsControlsProps = {
  value: Tactics;
  onChange: (value: Tactics) => void;
  disabled?: boolean;
  compact?: boolean;
};

export function TacticsControls({
  value,
  onChange,
  disabled = false,
  compact = false,
}: TacticsControlsProps) {
  const update = (changes: Partial<Tactics>) => onChange({ ...value, ...changes });

  return (
    <div className={`grid gap-4 ${compact ? '' : 'rounded-[18px] border border-white/10 bg-black/20 p-4'}`}>
      <section className="grid gap-3">
        <div>
          <p className="game-field-label">Nhịp độ / triết lý</p>
          <p className="mt-1 text-xs text-slate-400">
            Điều chỉnh độ mạo hiểm, tốc độ luân chuyển và mức dâng đội hình.
          </p>
        </div>
        <TacticSelect
          label="Nhịp độ"
          value={value.mentality}
          options={MENTALITY_OPTIONS}
          disabled={disabled}
          onChange={(mentality) => update({ mentality })}
        />
      </section>

      <section className="grid gap-3 border-t border-white/10 pt-4">
        <div>
          <p className="game-field-label">Phòng thủ</p>
          <p className="mt-1 text-xs text-slate-400">
            Độ rộng quyết định compactness; độ sâu điều khiển hàng thủ và pressing.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <LevelField
            label="Rộng"
            value={value.defensiveWidth}
            max={10}
            disabled={disabled}
            onChange={(defensiveWidth) => update({ defensiveWidth })}
          />
          <LevelField
            label="Độ sâu"
            value={value.defensiveDepth}
            max={10}
            disabled={disabled}
            onChange={(defensiveDepth) => update({ defensiveDepth })}
          />
        </div>
      </section>

      <section className="grid gap-3 border-t border-white/10 pt-4">
        <div>
          <p className="game-field-label">Tấn công</p>
          <p className="mt-1 text-xs text-slate-400">
            Chọn cách triển khai, tạo cơ hội và số lượng cầu thủ tham gia pha bóng.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <TacticSelect
            label="Xây dựng lối chơi"
            value={value.buildUpPlay}
            options={PLAY_STYLE_OPTIONS}
            disabled={disabled}
            onChange={(buildUpPlay) => update({ buildUpPlay })}
          />
          <TacticSelect
            label="Tạo cơ hội"
            value={value.chanceCreation}
            options={PLAY_STYLE_OPTIONS}
            disabled={disabled}
            onChange={(chanceCreation) => update({ chanceCreation })}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <LevelField
            label="Rộng"
            value={value.attackingWidth}
            max={10}
            disabled={disabled}
            onChange={(attackingWidth) => update({ attackingWidth })}
          />
          <LevelField
            label="Cầu thủ trong vòng cấm"
            value={value.playersInBox}
            max={10}
            disabled={disabled}
            onChange={(playersInBox) => update({ playersInBox })}
          />
          <LevelField
            label="Đá phạt góc"
            value={value.corners}
            max={5}
            disabled={disabled}
            onChange={(corners) => update({ corners })}
          />
          <LevelField
            label="Đá phạt"
            value={value.freeKicks}
            max={5}
            disabled={disabled}
            onChange={(freeKicks) => update({ freeKicks })}
          />
        </div>
      </section>
    </div>
  );
}

function TacticSelect<T extends TacticsMentality | TacticsPlayStyle>({
  label,
  value,
  options,
  disabled,
  onChange,
}: {
  label: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  disabled: boolean;
  onChange: (value: T) => void;
}) {
  return (
    <label className="block">
      <span className="game-field-label">{label}</span>
      <select
        className="game-input"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value as T)}
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

function LevelField({
  label,
  value,
  max,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  max: number;
  disabled: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block rounded-[12px] border border-white/8 bg-white/[0.035] p-3">
      <span className="flex items-center justify-between gap-3 text-xs font-bold uppercase tracking-[0.08em] text-slate-300">
        {label}
        <strong className="text-white">
          {value}/{max}
        </strong>
      </span>
      <input
        type="range"
        className="game-range mt-3 w-full"
        min={1}
        max={max}
        step={1}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}
