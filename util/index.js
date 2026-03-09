const R = require('ramda');
const { log } = require('./dbug');
const fs = require('node:fs');
module.exports = {
    ...require('./card'),
    ...require('./array'),
    ...require('./dbug'),
    ...require('./score'),
    isLocked: R.pipe(String.raw, (u) =>
        fs.existsSync(u)
            ? fs.statSync(u).mtimeMs + 81e3 > Date.now() ||
              fs.writeFileSync(u, '')
            : fs.writeFileSync(u, ''),
    ),
    refreshLock: R.pipe(
        String.raw,
        R.juxt([
            R.tryCatch(fs.unlinkSync, log),
            (f) => fs.writeFileSync(f, ``),
        ]),
    ),
    rmLock: R.pipe(String.raw, R.tryCatch(fs.unlinkSync, log)),
};
