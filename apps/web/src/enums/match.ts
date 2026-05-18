export const MatchMode = {
  Casual: 'casual',
  AiCampaign: 'ai_campaign',
} as const;

export type MatchMode = (typeof MatchMode)[keyof typeof MatchMode];
