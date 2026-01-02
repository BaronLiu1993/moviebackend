import { Router } from "express";

const router = Router();

// Convert CSV Data into Table Data, Upload into Data Lake -> Process
router.get("/load", (req, res) => {
  try {
    
    return res.status(200).json({ data: "" });
  } catch {
    return res.status(500).json({ message: "Internal Server Error" });
  }
});
