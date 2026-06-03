import { SetMetadata } from "@nestjs/common";
import { IS_ADMIN_ONLY_KEY } from "../constants/auth.constant";

export const AdminOnly = () => SetMetadata(IS_ADMIN_ONLY_KEY, true);
