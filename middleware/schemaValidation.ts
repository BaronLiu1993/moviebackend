import type { Request, Response, NextFunction } from "express";
import type { ZodType } from "zod";

export const validateZod = (schema: ZodType) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      schema.parse(req.body); 
      next(); 
    } catch (err) {
      return res.status(400).json({ message: "Validation Error" });
    }
  };
};