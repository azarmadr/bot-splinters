const fs = require('node:fs');
const util = require('node:util');

module.exports.logger = () => {
    const _file = 'log.txt';
    const logFile = fs.createWriteStream(_file, { flags: 'w' });
    const formatEd = (...x) => util.formatWithOptions({ colors: true }, ...x);
    return function (...args) {
        process.stdout.write(formatEd.apply(null, args) + '\n');
        logFile.write(
            util.format.apply(null, args).replace(/\033\[[0-9;]*m/g, '') + '\n',
        );
    };
};
