import { useEffect, useMemo, useState } from 'react';

import { apiRequest } from './api';

const DEFAULT_FORM = {
  formation: '4-3-3',
  passRatio: 58,
  shotRatio: 42,
  pressure: 61,
  mode: 'casual',
  gameplay: {
    passSpeedScale: 1.05,
    interceptionRadius: 1.02,
    gkBuildUpBias: 1,
    tempoScale: 1.05,
  },
};

function TacticsPage({ token, sessionData, user, onUnauthorized }) {
  const tacticsTeamId =
    sessionData?.team?.tacticsTeamId ||
    (sessionData?.user?.id ? `user-${sessionData.user.id}` : '');

  const [form, setForm] = useState(DEFAULT_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function loadTactics() {
      if (!tacticsTeamId) {
        setLoading(false);
        setError('Không xác định được tacticsTeamId của user hiện tại.');
        return;
      }

      setLoading(true);
      setError('');
      setMessage('');

      try {
        const payload = await apiRequest(`/api/v1/tactics/${tacticsTeamId}`, {
          token,
        });
        const data = payload?.data;
        if (!cancelled && data) {
          setForm({
            formation: data.formation || DEFAULT_FORM.formation,
            passRatio: Math.round(Number(data.passRatio || 0) * 100),
            shotRatio: Math.round(Number(data.shotRatio || 0) * 100),
            pressure: Math.round(Number(data.pressure || 0) * 100),
            mode: data.mode || DEFAULT_FORM.mode,
            gameplay: {
              passSpeedScale: Number(
                data.gameplay?.passSpeedScale || DEFAULT_FORM.gameplay.passSpeedScale,
              ),
              interceptionRadius: Number(
                data.gameplay?.interceptionRadius || DEFAULT_FORM.gameplay.interceptionRadius,
              ),
              gkBuildUpBias: Number(
                data.gameplay?.gkBuildUpBias || DEFAULT_FORM.gameplay.gkBuildUpBias,
              ),
              tempoScale: Number(data.gameplay?.tempoScale || DEFAULT_FORM.gameplay.tempoScale),
            },
          });
        }
      } catch (err) {
        if (err.status === 401 || err.status === 403) {
          onUnauthorized();
          return;
        }

        if (err.status === 404) {
          if (!cancelled) {
            setForm(DEFAULT_FORM);
          }
        } else if (!cancelled) {
          setError(err.message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadTactics();

    return () => {
      cancelled = true;
    };
  }, [onUnauthorized, tacticsTeamId, token]);

  const total = useMemo(() => form.passRatio + form.shotRatio + form.pressure, [form]);

  async function submitForm(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');

    try {
      const payload = await apiRequest('/api/v1/tactics', {
        method: 'POST',
        token,
        body: {
          teamId: tacticsTeamId,
          formation: form.formation,
          passRatio: Number(form.passRatio),
          shotRatio: Number(form.shotRatio),
          pressure: Number(form.pressure),
          mode: form.mode,
          gameplay: {
            passSpeedScale: Number(form.gameplay.passSpeedScale),
            interceptionRadius: Number(form.gameplay.interceptionRadius),
            gkBuildUpBias: Number(form.gameplay.gkBuildUpBias),
            tempoScale: Number(form.gameplay.tempoScale),
          },
        },
      });

      const data = payload?.data;
      if (data) {
        setForm({
          formation: data.formation,
          passRatio: Math.round(Number(data.passRatio || 0) * 100),
          shotRatio: Math.round(Number(data.shotRatio || 0) * 100),
          pressure: Math.round(Number(data.pressure || 0) * 100),
          mode: data.mode || DEFAULT_FORM.mode,
          gameplay: {
            passSpeedScale: Number(
              data.gameplay?.passSpeedScale || DEFAULT_FORM.gameplay.passSpeedScale,
            ),
            interceptionRadius: Number(
              data.gameplay?.interceptionRadius || DEFAULT_FORM.gameplay.interceptionRadius,
            ),
            gkBuildUpBias: Number(
              data.gameplay?.gkBuildUpBias || DEFAULT_FORM.gameplay.gkBuildUpBias,
            ),
            tempoScale: Number(data.gameplay?.tempoScale || DEFAULT_FORM.gameplay.tempoScale),
          },
        });
      }
      setMessage('Đã lưu chiến thuật thành công và đẩy sang realtime match engine.');
    } catch (err) {
      if (err.status === 401 || err.status === 403) {
        onUnauthorized();
        return;
      }
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <article className="game-panel game-panel--accent overflow-hidden p-5 sm:p-6">
        <div className="game-panel__content">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="game-header-kicker">Tactics Forge</p>
              <h2 className="game-title mt-3 text-3xl font-bold text-white">
                Bảng điều khiển lối chơi đội bóng
              </h2>
              <p className="game-copy mt-3 max-w-2xl text-base">
                Chỉnh logic triển khai bóng, áp lực và gameplay modifiers như một game manager thực
                thụ, sau đó lưu thẳng sang service realtime.
              </p>
            </div>
          </div>

          <p className="mt-4 text-sm leading-6 text-slate-300">
            Tactics Team ID hiện tại:{' '}
            <span className="font-semibold text-emerald-300">{tacticsTeamId || 'N/A'}</span>.{' '}
            {sessionData?.team?.clubName ? `CLB tham chiếu: ${sessionData.team.clubName}.` : ''}
          </p>

          {loading ? (
            <Notice text="Đang tải config chiến thuật từ server..." tone="info" />
          ) : (
            <form className="mt-5 space-y-4" onSubmit={submitForm}>
              <SelectField
                label="Formation"
                value={form.formation}
                options={['4-3-3', '4-4-2']}
                onChange={(value) => setForm((current) => ({ ...current, formation: value }))}
              />

              <div className="grid gap-4 sm:grid-cols-3">
                <SliderField
                  label="Pass Ratio"
                  value={form.passRatio}
                  onChange={(value) => setForm((current) => ({ ...current, passRatio: value }))}
                />
                <SliderField
                  label="Shot Ratio"
                  value={form.shotRatio}
                  onChange={(value) => setForm((current) => ({ ...current, shotRatio: value }))}
                />
                <SliderField
                  label="Pressure"
                  value={form.pressure}
                  onChange={(value) => setForm((current) => ({ ...current, pressure: value }))}
                />
              </div>

              <div className="grid gap-4 rounded-[24px] border border-white/10 bg-black/20 p-4">
                <SelectField
                  label="Match Mode Profile"
                  value={form.mode}
                  options={['ranked', 'casual', 'ai_campaign']}
                  onChange={(value) => setForm((current) => ({ ...current, mode: value }))}
                />

                <div className="grid gap-4 sm:grid-cols-2">
                  <ScaledSliderField
                    label="Pass Speed Scale"
                    value={form.gameplay.passSpeedScale}
                    min={0.65}
                    max={1.45}
                    step={0.01}
                    onChange={(value) =>
                      setForm((current) => ({
                        ...current,
                        gameplay: {
                          ...current.gameplay,
                          passSpeedScale: value,
                        },
                      }))
                    }
                  />
                  <ScaledSliderField
                    label="Interception Radius"
                    value={form.gameplay.interceptionRadius}
                    min={0.55}
                    max={1.6}
                    step={0.01}
                    onChange={(value) =>
                      setForm((current) => ({
                        ...current,
                        gameplay: {
                          ...current.gameplay,
                          interceptionRadius: value,
                        },
                      }))
                    }
                  />
                  <ScaledSliderField
                    label="GK Build-up Bias"
                    value={form.gameplay.gkBuildUpBias}
                    min={0.5}
                    max={2.0}
                    step={0.01}
                    onChange={(value) =>
                      setForm((current) => ({
                        ...current,
                        gameplay: { ...current.gameplay, gkBuildUpBias: value },
                      }))
                    }
                  />
                  <ScaledSliderField
                    label="Tempo Scale"
                    value={form.gameplay.tempoScale}
                    min={0.75}
                    max={1.4}
                    step={0.01}
                    onChange={(value) =>
                      setForm((current) => ({
                        ...current,
                        gameplay: { ...current.gameplay, tempoScale: value },
                      }))
                    }
                  />
                </div>
              </div>

              <div className="game-stat-card">
                Tổng thiên hướng hiện tại:{' '}
                <span className="font-semibold text-emerald-300">{total}</span>
              </div>

              {message && <Notice text={message} tone="success" />}
              {error && <Notice text={error} tone="error" />}

              <button type="submit" disabled={saving} className="game-button-primary w-full">
                {saving ? 'Saving...' : 'Save Tactics'}
              </button>
            </form>
          )}
        </div>
      </article>

      <aside className="game-panel overflow-hidden p-5 sm:p-6">
        <div className="game-panel__content">
          <p className="game-header-kicker">Realtime Sync</p>
          <div className="mt-4 space-y-3 text-sm leading-6 text-slate-300">
            <p className="game-stat-card">
              Mỗi user sẽ lưu chiến thuật theo tacticsTeamId riêng. Realtime engine tự bind
              tacticsTeamId vào team slot phù hợp trong trận đang chạy.
            </p>
            <p className="game-stat-card">
              Khi nhấn save, chiến thuật được lưu vào service-core rồi push tiếp sang
              service-realtime để ảnh hưởng logic trận đấu.
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              <div className="game-stat-card">
                <p className="game-stat-card__label">Current Profile</p>
                <p className="mt-2 text-lg font-semibold text-white">{form.mode}</p>
              </div>
              <div className="game-stat-card">
                <p className="game-stat-card__label">Formation</p>
                <p className="mt-2 text-lg font-semibold text-white">{form.formation}</p>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </section>
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
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function SliderField({ label, value, onChange }) {
  return (
    <label className="game-stat-card block">
      <span className="game-field-label">{label}</span>
      <input
        type="range"
        min="0"
        max="100"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="game-range"
      />
      <div className="mt-3 flex items-center justify-between text-sm">
        <span className="text-slate-400">0</span>
        <span className="font-semibold text-white">{value}</span>
        <span className="text-slate-400">100</span>
      </div>
    </label>
  );
}

function ScaledSliderField({ label, value, min, max, step, onChange }) {
  return (
    <label className="game-stat-card block">
      <span className="game-field-label">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="game-range"
      />
      <div className="mt-3 flex items-center justify-between text-sm">
        <span className="text-slate-400">{min.toFixed(2)}</span>
        <span className="font-semibold text-white">{Number(value).toFixed(2)}</span>
        <span className="text-slate-400">{max.toFixed(2)}</span>
      </div>
    </label>
  );
}

function Notice({ text, tone }) {
  const toneClass =
    tone === 'success'
      ? 'game-notice--success'
      : tone === 'error'
        ? 'game-notice--error'
        : 'game-notice--info';

  return <p className={`game-notice ${toneClass}`}>{text}</p>;
}

export default TacticsPage;
