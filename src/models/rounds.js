import mongoose from "mongoose";

const Schema = new mongoose.Schema({
    id: { type: Number, required: true },
    result: { type: Number, required: true },
    time: { type: Date, default: new Date() },
    exchangeRateId: { type: Number, required: true },
});

export default function (gameConfigName) {
    return mongoose.model(`${gameConfigName}_rounds`, Schema);
}
