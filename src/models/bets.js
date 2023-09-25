import mongoose from "mongoose";

const schema = new mongoose.Schema({
    uid: { type: String, required: true },
    name: { type: String, required: true },

    multiplier: { type: Number, default: 0 },

    amount: { type: Number, default: 0 },
    betwin: { type: Number, default: 0 },
    time: { type: Date },

    siteId: { type: String },
    freeBet: { type: Boolean, default: false },

    currency: { type: String, required: true },
    rate: { type: Number, required: true },

    playerId: { type: Number },
    operatorId: { type: String, required: true },
    roundId: { type: Number, default: 0, required: true },
    paid: { type: Boolean, default: false },

    autoCashOut: { type: Number },
});

export default mongoose.model("crashgame_bets", schema);
