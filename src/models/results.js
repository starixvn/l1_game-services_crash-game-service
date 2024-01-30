import mongoose from "mongoose";

const PFResultSchema = new mongoose.Schema({
    roundId: { type: Number, required: true },
    serverSeed: { iv: { type: String }, content: { type: String } },
    serverSeedHash: { iv: { type: String }, content: { type: String } },
    clientSeeds: { type: Array, default: [] },
    mergeSeed: { type: String },
    finalHash: { type: String },
    time: { type: Date, default: new Date() },
});

export default function (gameConfigName) {
    return mongoose.model(`${gameConfigName}_pf_results`, PFResultSchema);
}
