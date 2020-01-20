import * as generatos from './generators';

(async function main() {
    try {
        generatos.setup();
        Promise.all([
            await generatos.copyGithubStyle(),
            await generatos.generateHtmlFiles(),
            await generatos.generateIndex(),
            await generatos.copyResumeToRoot(),
        ]);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
})();
