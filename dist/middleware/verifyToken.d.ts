import { type Request, type Response, type NextFunction } from "express";
import { SupabaseClient } from "@supabase/supabase-js";
declare module "express-serve-static-core" {
    interface Request {
        user?: {
            sub: string;
            email?: string;
            [key: string]: unknown;
        };
        token?: string;
        supabaseClient?: SupabaseClient;
    }
}
export declare function verifyToken(req: Request, res: Response, next: NextFunction): Promise<void>;
//# sourceMappingURL=verifyToken.d.ts.map