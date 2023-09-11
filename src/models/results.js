import { Core } from "sc-game-base";
import mongoose from "mongoose";

export default mongoose.model("crashgame_results", Core.Models.ResultSchema);
