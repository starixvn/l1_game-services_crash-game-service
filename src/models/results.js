import mongoose from "mongoose";
import { ResultSchema } from "sc-game-base/src/core/models";

export default function (gameConfigName) {
    return mongoose.model(`${gameConfigName}_results`, ResultSchema);
}
