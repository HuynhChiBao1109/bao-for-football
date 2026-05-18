export const GachaBannerStatus = {
  Inactive: 0,
  Active: 1,
} as const;

export type GachaBannerStatus = (typeof GachaBannerStatus)[keyof typeof GachaBannerStatus];
