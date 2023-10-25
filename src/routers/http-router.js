import { utils } from "sc-common";
import { Table } from "sc-game-base";

export default class HttpRouter extends Table.Routers.TableHttpRouter {
    init(app) {
        super.init(app);

        app.post(
            "/api/set-result",
            utils.authentication.useAuthenticate({
                authUrl: this.appConfigs.apiSettings.authUrl,
                audiences: this.appConfigs.authenticateSettings.audiences,
            }),
            (_req, res) => this.handleSetBoard(_req.body, res)
        );
    }

    handleSetBoard(params, res) {
        try {
            if (!params || !params.result) {
                this.logService.logError("receives a result cheating call with invalid params.");
                res.send({ error: true });

                return;
            }

            this.logService.logWarning(`receives a result cheating call for ${params?.name} with the board as ${params.result}.`);

            this.gameData.settlementResultFromAdmin = { result: params.result, roundId: params.roundId };

            res.send({ error: false });
        } catch (error) {
            this.logService.logError(error);
            res.send({ error: true });
        }
    }
}
