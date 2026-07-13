export type PlayerAiTendencies = {
  defensiveWorkRate: number;
  stayForwardBias: number;
  passBias: number;
  shootBias: number;
  dribbleBias: number;
  flairBias: number;
  riskTaking: number;
  offBallRunBias: number;
  boxInfiltrationBias: number;
  shootSkillChargeMultiplier: number;
  dribbleSkillChargeMultiplier: number;
};

export type PlayerAiProfile = {
  code: string;
  label: string;
  tendencies: PlayerAiTendencies;
};

export const DEFAULT_PLAYER_AI_PROFILE: PlayerAiProfile = {
  code: "balanced",
  label: "Balanced AI",
  tendencies: {
    defensiveWorkRate: 1,
    stayForwardBias: 0,
    passBias: 1,
    shootBias: 1,
    dribbleBias: 1,
    flairBias: 0,
    riskTaking: 0.5,
    offBallRunBias: 1,
    boxInfiltrationBias: 0,
    shootSkillChargeMultiplier: 1,
    dribbleSkillChargeMultiplier: 1,
  },
};
