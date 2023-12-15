import mongoose from "mongoose";
import { stubMongoose } from "jest-micro-auto-stub";
import HistoryQuery from "../history-query";
import Chance from "chance";

const chance = new Chance();
const roundQuery = stubMongoose(mongoose.Model),
    betsRepository = stubMongoose(mongoose.Model),
    betLogsRepository = stubMongoose(mongoose.Model);

describe("historyQuery", () => {
    const historyQuery = new HistoryQuery(roundQuery, betsRepository, betLogsRepository);

    describe("convertBet", () => {
        it("should add totalAmount to bet", () => {
            // Arrange
            const bet = { amount: chance.natural() };

            // Act
            const actualResult = historyQuery.convertBet(bet);

            // Assert
            expect(actualResult).toStrictEqual({ ...bet, totalAmount: bet.amount });
        });
    });
});
