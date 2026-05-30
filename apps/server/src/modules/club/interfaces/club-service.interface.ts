export interface ClubServiceInterface {
  getClubById(id: number): Promise<any>;
}
