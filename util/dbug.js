const R = require('ramda');
const D = {},
    F = {},
    E = {};

var _wake;
const rl = require('node:readline');
rl.emitKeypressEvents(process.stdin);
const rlInterface = rl.createInterface({
    input: process.stdin,
    output: process.stdout,
});
rlInterface.pause();
process.stdin.on('keypress', (_, k) => {
    _wake = 1;
    rlInterface.pause();
    rl.moveCursor(process.stdout, 0, k && k.name === 'return' ? -1 : 0);
});

function sleep(ms, { msg, showTrace } = {}) {
    rlInterface.resume();
    process.stdout.write('\x1B[?25l');
    [...Array(27).keys()].forEach(() => {
        process.stdout.write('\u2591');
    });
    rl.cursorTo(process.stdout, 0);
    if (showTrace) {
        const obj = {};
        Error.captureStackTrace(obj, sleep);
        const caller = obj.stack.replace('Error', '`sleep()` Called From');
        console.log(caller);
    }
    return [...Array(27).keys()].reduce(
        (memo, e) =>
            memo.then(async () => {
                process.stdout.write('\u2588');
                if (e === 26) {
                    rl.clearLine(process.stdout, 0) &&
                        rl.cursorTo(process.stdout, 0);
                    if (msg) console.log(msg);
                    _wake = 0;
                    rlInterface.pause();
                }
                if (_wake && e < 27) return;
                return new Promise((resolve) => setTimeout(resolve, ms / 27));
            }),
        Promise.resolve(),
    );
}

// TODO the above code from `const rl` was under try-catch
// figure out if it still needs to be so
D.timer = class {
    constructor() {
        this.t = Date.now();
    }
    get _d() {
        const t = Date.now() - this.t;
        this.t = Date.now();
        return `${t > 6e4 ? `${Math.floor(t / 6e4)}:` : ''}${Math.floor((t / 1e3) % 60)}`;
    }
};
D.isEObj = (o) =>
    o &&
    Object.keys(obj).length === 0 &&
    Object.getPrototypeOf(obj) === Object.prototype;
const _logTimer = new D.timer();
const log = (...m) =>
    console.log(
        _logTimer._d,
        new Error().stack
            .split('\n')
            .find(
                (c, i) =>
                    (!c.includes('D') && i === 2) ||
                    (!c.includes('tt') && i === 3) ||
                    i === 4,
            )
            .match(/[^:\\/]+:\d+/)?.[0],
        ...m,
    );
const dbug = (...m) => process.env.displayDebug || log(...m);

D.f =
    (f, cb) =>
    (...args) => {
        const ret = f(...args);
        const _ = { args: args.slice(0, f.length), ret };
        log('dbug', { ..._, ...(cb && { cb: cb(_) }) });
        return ret;
    };
D.r = (n) => (v) => (n-- && log(v)) || v;
D.t = (n) => {
    let arr = [],
        done = 1;
    return (v) => {
        if (n--) arr.push(v);
        else if (done) done = console.table(arr) ?? 0;
    };
};
D.in1 = (...m) => {
    rl.clearLine(process.stdout, 0);
    rl.cursorTo(process.stdout, 0);
    console.log(`tt: ${m}`);
    rl.moveCursor(process.stdout, 0, -1);
};
D.table = (m) => {
    const toFixed = (o) => {
        for (k in o) {
            if (!Number.isNaN(+o[k])) o[k] = Number(Number(o[k]).toFixed(3));
            if (typeof o[k] === 'object') toFixed(o[k]);
        }
    };
    toFixed(m);
    console.table(m);
    try {
        rl.moveCursor(process.stdout, 0, -1);
        log();
    } catch (e) {
        console.warn(e);
    }
    false;
};
D.tt = new Proxy(
    {},
    {
        set: (obj, prop, v) => {
            if (Object.hasOwn(obj, prop)) obj[prop].push(v);
            else {
                obj[prop] = [v];
            }
        },
        deleteProperty: (obj, prop) =>
            prop in obj &&
            obj[prop].length &&
            (D.table(obj[prop]) || delete obj[prop]),
    },
);
D.$1s = new Proxy(
    {},
    {
        set: (obj, prop, v) => (obj[prop] ??= 1 + log(v)),
        get:
            (obj, prop) =>
            (f) =>
            (...args) =>
                (obj[prop] ??= f(...args)),
    },
);
F.retryFor = (n, to, continueAfterAllRetries = 0, func, err = '') => {
    if (!--n) {
        log({ 'Failed after multiple retries': n });
        return Promise[continueAfterAllRetries ? 'resolve' : 'reject'](err);
    }
    return func().catch(async (err) => {
        log({ 'nth retry': n });
        await sleep(to).then(() =>
            F.retryFor(n, to, continueAfterAllRetries, func, err),
        );
    });
};
//const pathOrSet=>(v,path,arr)=>arr
F.cached = (fn, map = {}) =>
    R.type(fn) === 'Function'
        ? (...arg) =>
              (arg.reduce((map, a) => (map[a] ??= {}), map).__ ??= F.cached(
                  fn(...arg),
              ))
        : //(...arg)=>R.init(arg).reduce((map,a)=>map[a]??={},map)[R.last(arg)]??=F.cached(fn(...arg))
          fn;
E.click = async (page, selector, timeout = 20000, delayBeforeClicking = 0) => {
    await page
        .waitForSelector(selector, { timeout })
        .then((_) =>
            sleep(delayBeforeClicking).then((_) =>
                page.$eval(selector, (e) => e.click()),
            ),
        );
};
E.getText = async (page, selector, timeout = 20000) => {
    const element = await page.waitForSelector(selector, { timeout });
    const text = await element.evaluate((el) => el.textContent);
    return text;
};
E.getTextByXpath = async (page, selector, timeout = 20000) => {
    const element = await page.waitForXPath(selector, { timeout });
    const text = await element.evaluate((el) => el.textContent);
    return text;
};

module.exports = { log, sleep, D, F, E, dbug };
