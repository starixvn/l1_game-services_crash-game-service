import { QueryApis } from "sc-game-base/src/core";
import { decrypt } from "sc-game-base/src/core/helpers/crypto-helper";
export default class RoundQuery extends QueryApis.RoundQuery {
    constructor(roundsRepository, resultsRepository) {
        super(roundsRepository);
        this.resultsRepository = resultsRepository;
    }
    async getList(limit, projections) {
        const rounds = await this.roundsRepository
            .find({}, projections, { sort: { _id: -1 }, limit: limit })
            .lean()
            .exec();

        const roundHistory = await Promise.all(
            rounds.map(async (round) => {
                const result = round.result || this.convertResult(round);
                const md5Result = this.resultsRepository ? await this.getMd5Result(round.id) : {};

                return {
                    roundId: round.id,
                    result,
                    md5Result,
                };
            })
        );

        return roundHistory;
    }

    async getMd5Result(roundId) {
        const md5Result = this.resultsRepository.findOne({ roundId }, "encryptedResultHash").lean().exec();
        if (!md5Result) {
            return {};
        }
        const decryptedResultHash = decrypt(md5Result.encryptedResultHash);

        return JSON.parse(decryptedResultHash);
    }
}
