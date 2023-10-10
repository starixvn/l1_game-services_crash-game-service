import { stubMongoose } from "jest-micro-auto-stub";
import mongoose from "mongoose";
import RoundQuery from "../round-query";

jest.mock("sc-game-base/src/core/helpers/crypto-helper", () => {
    return {
        decrypt: jest.fn((hash) => {
            return '{"hashValue":"9de49b68cab2f90042e58ccf6a1c82b6","rawValue":"2.16_{#215296717989c57495e01ed7df74}","roundId":1}';
        }),
    };
});

describe("round query test", () => {
    /** @type {mongoose.Model}*/
    const roundsRepository = stubMongoose(mongoose.Model);
    /** @type {mongoose.Model}*/
    const resultsRepository = stubMongoose(mongoose.Model);

    const roundQuery = new RoundQuery(roundsRepository, resultsRepository);
    beforeEach(() => {
        spyOn(roundQuery, "convertResult");
    });

    describe("getList", () => {
        it("always_calls roundsRepository", async () => {
            // arrange
            const rounds = [{ id: 1, result: 2.15 }];
            roundsRepository.find().lean().exec.mockReturnValueOnce(rounds);

            // act
            await roundQuery.getList(10, {});

            // assert
            expect(roundsRepository.find().lean().exec).toHaveBeenCalled();
        });

        describe("result is null", () => {
            it("should calls convertResult", async () => {
                // arrange
                const rounds = [{ id: 1, result: null }];
                roundsRepository.find().lean().exec.mockReturnValueOnce(rounds);

                // act
                await roundQuery.getList(10, {});

                // assert
                expect(roundQuery.convertResult).toHaveBeenCalled();
            });
        });

        describe("result is undefined", () => {
            it("should calls convertResult", async () => {
                // arrange
                const rounds = [{ id: 1, result: undefined }];
                roundsRepository.find().lean().exec.mockReturnValueOnce(rounds);

                // act
                await roundQuery.getList(10, {});

                // assert
                expect(roundQuery.convertResult).toHaveBeenCalled();
            });
        });

        describe("when result is not null/undefined", () => {
            it("should not call convertResult", async () => {
                // arrange
                const result = 2.16;
                const rounds = [{ id: 1, result }];
                roundsRepository.find().lean().exec.mockReturnValueOnce(rounds);

                // act
                await roundQuery.getList(10, {});

                // assert
                expect(roundQuery.convertResult).not.toHaveBeenCalled();
            });
        });

        describe("when getMd5Result not call", () => {
            it("should return data", async () => {
                // arrange
                const result = 2.16;
                const rounds = [{ id: 1, result }];
                const md5Result = { hashValue: "3js4j2kjl23jlk", rawValue: "2.16", roundId: 1 };
                roundsRepository.find().lean().exec.mockReturnValueOnce(rounds);
                resultsRepository.find().lean().exec.mockReturnValueOnce(md5Result);
                const expected = [
                    {
                        roundId: 1,
                        result: 2.16,
                        md5Result: {},
                    },
                ];
                // act
                const actual = await roundQuery.getList(10, {});

                // assert
                expect(actual).toStrictEqual(expected);
            });
        });

        describe("when getMd5Result called", () => {
            it("should return data", async () => {
                // arrange
                const result = 2.16;
                const rounds = [{ id: 1, result }];
                const md5Result = {
                    iv: "9de49b68cab2f90042e58ccf6a1c82b6",
                    content: "48f335a20bf53dd979de724fb33558b7f172f60759b718a1490e283d3",
                };

                await resultsRepository.findOne().lean().exec.mockReturnValue(md5Result);
                roundsRepository.find().lean().exec.mockReturnValueOnce(rounds);

                const expected = [
                    {
                        roundId: 1,
                        result: 2.16,
                        md5Result: {
                            hashValue: "9de49b68cab2f90042e58ccf6a1c82b6",
                            rawValue: "2.16_{#215296717989c57495e01ed7df74}",
                            roundId: 1,
                        },
                    },
                ];
                // act
                const actual = await roundQuery.getList(10, {});

                // assert
                expect(actual).toStrictEqual(expected);
            });
        });
    });
});
