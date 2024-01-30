import { getMergeSeed, getSHA256Hash, getSHA512Hash } from "../helpers/seed-helper";
import { generateServerSeed } from "../helpers/server-seed-helper";

export default class PFRoundResultConsumer {
    constructor(gameData, definition, roundResultPublisher, resultsRepository) {
        this.gameData = gameData;
        this.definition = definition;
        this.roundResultPublisher = roundResultPublisher;
        this.resultsRepository = resultsRepository;
    }

    async generateResult() {
        const resultFromAdmin = this.gameData.settlementResultFromAdmin;
        const { roundId } = this.gameData;

        if (roundId === resultFromAdmin.roundId) {
            this.gameData.result = resultFromAdmin.result;
        } else {
            const { serverSeed, clientSeeds } = this.gameData.pf;
            const mergeSeed = getMergeSeed(serverSeed, clientSeeds);
            const finalHash = getSHA512Hash(mergeSeed);
            const pf = { serverSeed, clientSeeds, mergeSeed, finalHash };

            await this.resultsRepository.findOneAndUpdate(
                {
                    roundId,
                },
                {
                    ...pf,
                }
            );

            this.gameData.pf = pf;
            this.gameData.result = this.definition.generateResult(finalHash);
        }
    }

    async generateServerSeedAndPublishHash(lastResultRecord) {
        if (lastResultRecord && lastResultRecord.roundId === this.gameData.roundId) {
            const { serverSeed, serverSeedHash, clientSeeds, mergeSeed, finalHash } = lastResultRecord;

            this.gameData.pf = { serverSeed, serverSeedHash, clientSeeds, mergeSeed, finalHash };
            this.gameData.result = this.definition.generateResult(finalHash);
        } else {
            const { randomMode } = this.gameData.gameConfigs;
            const serverSeed = generateServerSeed(randomMode);
            const serverSeedHash = getSHA256Hash(serverSeed);

            this.gameData.pf = { serverSeed, serverSeedHash };

            await this.createResultRecord(serverSeed, serverSeedHash);

            this.roundResultPublisher.publishServerSeedHash();
        }
    }

    async createResultRecord(serverSeed, serverSeedHash) {
        await this.resultsRepository.create({
            roundId: this.gameData.roundId,
            serverSeedHash: serverSeedHash,
            serverSeed: serverSeed,
            time: new Date(),
        });
    }
}
