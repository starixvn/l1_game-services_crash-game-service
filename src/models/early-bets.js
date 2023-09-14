import mongoose from "mongoose";

const schema = new mongoose.Schema({
    uid: { type: String, required: true },
    name: { type: String, required: true },
    actions: { type: Array, default: [] },
    operatorId: { type: String, required: true },
    roundId: { type: Number, default: 0, required: true },
});

export default mongoose.model("crashgame_earlybets", schema);
