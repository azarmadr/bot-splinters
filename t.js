import { args } from './util/common.js';
import { splinterApi, createPage } from './splinterApi.js';
import { createWriteStream } from 'node:fs';

const filePath = 'data/network.jsonl';
const JsonLStreamer = (filePath) => {
    const stream = createWriteStream(filePath, 'utf-8');
    return {
        write: async (record) => {
            const line = JSON.stringify(record) + '\n';
            // Respect backpressure
            if (!stream.write(line)) {
                await new Promise((resolve) => stream.once('drain', resolve));
            }
        },
        end: () => stream.end(),
        on: stream.on,
    };
};
const stream = JsonLStreamer(filePath);

const page = await createPage(args);
page.on('requestfinished', async (request) => {
    const url = request.url();
    if (url.match(/googletagmanager|cloudfront.net|splinterlands.zendesk.com/))
        return;
    if (url.match(/g.doubleclick|google.co|appleid.cdn|zdassets.com/)) return;
    if (url.match(/config.js|settings$|bootstrap|cdn.jsdelivr|\/auctions\//))
        return;

    const respHeaders = request.response().headers();

    if (
        respHeaders['content-type'] &&
        respHeaders['content-type'].includes`/json;`
    ) {
        try {
            const response = await request.response().json();
            stream.write({ response, url });
        } catch (e) {
            console.log(respHeaders);
            console.log(e);
        }
    }
});
const nSM = await splinterApi(
    page,
    { account: args.ACCOUNT[2], password: args.PASSWORD[2] },
    args,
);
await nSM.login();
for (let i = 0; i < 222; i++) {
    console.log({ i });
    nSM.clickButtonWith('MODERN');
    for (const urlRegex of [/battle-history/, /find-match/])
        !(await page
            .waitForFunction(() => document.URL.match(urlRegex), {
                timeout: 1e5,
                polling: 1e3,
            })
            .catch(console.log));
    const details = await parseBattleDetails().catch(console.log);
    console.log(details);
}
