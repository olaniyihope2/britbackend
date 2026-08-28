import express from "express";

import {
  createProgramme,
  getProgrammes,
  getProgramme,
  updateProgramme,
  deleteProgramme,
} from "../controller/programmeController.js";

const router = express.Router();


router.post("/", createProgramme);

router.get("/", getProgrammes);

router.get("/:id", getProgramme);

router.put("/:id", updateProgramme);

router.delete("/:id", deleteProgramme);


export default router;