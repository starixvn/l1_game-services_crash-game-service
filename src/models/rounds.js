import mongoose from "mongoose";

const modelName = "crashgame_rounds";

const Schema = new mongoose.Schema({
    id: { type: Number, required: true },
    result: { type: Number, required: true },
    time: { type: Date, default: new Date() },
    exchangeRateId: { type: Number, required: true },
});

export default mongoose.model(modelName, Schema);
