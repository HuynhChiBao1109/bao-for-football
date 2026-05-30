import { SetMetadata } from "@nestjs/common";
import { IS_ADMIN_ONLY_KEY } from "../constants/auth.constants";

export const AdminOnly = () => SetMetadata(IS_ADMIN_ONLY_KEY, true);
