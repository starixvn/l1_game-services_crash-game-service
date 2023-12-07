import { Core } from "sc-game-base";

export default class RoundResultPublisher extends Core.BaseEventPublishers.RoundResultPublisher {
    publishRoundResult(roundResult) {
        const payload = { finish: roundResult };

        if (this.gameData.resultHash.rawValue) {
            payload.finish.md5Result = this.gameData.resultHash;

            this.publishToAllUsers({
                ...payload,
                resultHash: { rawValue: this.gameData.resultHash.rawValue, extraInfos: this.gameData.result },
            });
        } else {
            this.publishToAllUsers(payload);
        }
    }
}
