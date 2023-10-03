import mongoose from "mongoose";

const Schema = new mongoose.Schema({
    uid: { type: String, required: true },
    name: { type: String, required: true },

    action: { type: String },
    amount: { type: Number, default: 0 },
    winAmount: { type: Number, default: 0 },
    receivedTime: { type: Date, required: true },

    time: { type: Date },

    siteId: { type: String },

    currency: { type: String, required: true },
    rate: { type: Number, required: true },

    playerId: { type: Number },
    operatorId: { type: String, required: true },
    roundId: { type: Number, default: 0, required: true },
});

export default mongoose.model("crashgame_betlogs", Schema);
