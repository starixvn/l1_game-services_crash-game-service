import mongoose from "mongoose";

const Schema = new mongoose.Schema({
    multiplier: { type: Number, default: 0 },
    time: { type: Date },
    roundId: { type: Number, default: 0, required: true },
});

export default mongoose.model("crashgame_livegamelogs", Schema);
