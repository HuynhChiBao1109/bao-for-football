export interface RegisterInputDto {
  username: string;
  password: string;
}

export interface LoginInputDto {
  username: string;
  password: string;
}

export interface AssignClubInputDto {
  userId: number;
  clubId: number;
}
