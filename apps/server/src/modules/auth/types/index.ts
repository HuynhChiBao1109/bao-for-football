export interface TokenClaims {
  userId: number;
  username: string;
  isAdmin: boolean;
}

export interface AuthUser {
  id: number;
  username: string;
  isAdmin: boolean;
}

export interface TeamAssignment {
  userId: number;
  clubId?: number;
  clubName: string;
  image: string;
  budget: number;
  rankPoint: number;
  tacticsTeamId: string;
}

export interface ClubOption {
  id: number;
  name: string;
  logo: string;
  countryId?: number;
  leagueId?: number;
  budget: number;
  leagueName: string;
}
