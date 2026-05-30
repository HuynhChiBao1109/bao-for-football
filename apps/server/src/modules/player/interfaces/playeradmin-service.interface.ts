export interface PlayerAdminServiceInterface {
  listPlayers(filters: Record<string, any>): Promise<any>;
  detailPlayer(id: number): Promise<any>;
  createPlayer(body: any): Promise<any>;
  updatePlayer(id: number, body: any): Promise<any>;
  deletePlayer(id: number): Promise<any>;
  listCountries(): Promise<any>;
  createCountry(body: any): Promise<any>;
  listLeagues(): Promise<any>;
  createLeague(body: any): Promise<any>;
  updateLeague(id: number, body: any): Promise<any>;
  deleteLeague(id: number): Promise<any>;
  createClub(body: any): Promise<any>;
  listSkills(): Promise<any>;
  createSkill(body: any): Promise<any>;
  assignSkill(id: number, body: any): Promise<any>;
  removeSkill(playerId: number, skillId: number): Promise<any>;
}
