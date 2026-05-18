type Tone = 'info' | 'error' | 'success' | 'muted';

const toneClass: Record<Tone, string> = {
  info: 'game-notice game-notice--info',
  error: 'game-notice game-notice--error',
  success: 'game-notice game-notice--success',
  muted: 'game-notice game-notice--muted',
};

export function Banner({ text, tone = 'info' }: { text: string; tone?: Tone }) {
  return <p className={toneClass[tone]}>{text}</p>;
}
