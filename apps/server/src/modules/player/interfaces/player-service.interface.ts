export interface IPlayerService {
  listMyCards(userId: number): Promise<any>;
  allocateStats(
    userId: number,
    playerUserId: number,
    body: Record<string, number>,
  ): Promise<any>;
}
