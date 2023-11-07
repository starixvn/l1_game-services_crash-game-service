import mongoose from "mongoose";
import { Core } from "sc-game-base";

export default function (gameConfigName) {
    return mongoose.model(`${gameConfigName}_results`, Core.Models.ResultSchema);
}
