import mongoose from "mongoose";

const PFResultSchema = new mongoose.Schema({
    roundId: { type: Number, required: true },
    serverSeed: { type: String },
    serverSeedHash: { type: String },
    clientSeeds: { type: Array, default: [] },
    mergeClientSeed: { type: String },
    mergeSeed: { type: String },
    finalHash: { type: String },
    time: { type: Date, default: new Date() },
});

export default function (gameConfigName) {
    return mongoose.model(`${gameConfigName}_pf_results`, PFResultSchema);
}
