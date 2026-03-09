const fs = require('node:fs');
const util = require('node:util');

module.exports.logger = () => {
    const _file = 'log.txt';
    const logFile = fs.createWriteStream(_file, { flags: 'w' });
    const formatEd = (...x) => util.formatWithOptions({ colors: true }, ...x);
    return (...args) => {
        process.stdout.write(`${formatEd.apply(null, args)}\n`);
        logFile.write(
            `${util.format.apply(null, args).replace(/\033\[[0-9;]*m/g, '')}\n`,
        );
    };
};
const l2s = (s) => {
    const res = s
        .split('_')
        .map((x) => x[0])
        .join('')
        .toLowerCase();
    // console.log(s, res);
    return res;
};
const args = require('minimist')(process.argv.slice(2)); // TODO use `util.parseArgs` instead
try {
    Object.entries(util.parseEnv(fs.readFileSync('.env', 'utf8'))).forEach(([e, v]) => {
        if (!v.includes(',')) args[l2s(e)] ??= v && JSON.parse(v);
        args[e] ??= v.includes(',')
            ? (args[l2s(e)] ?? v).split(',')
            : args[l2s(e)];
    });
} catch (e) {
    console.error(e);
    throw `NO '.env' file present
  Please create a new '.env' file following the '.env-example'`;
}
if (!['ACCOUNT', 'PASSWORD'].every((e) => args[e]))
    throw console.error(
        'Missing ACCOUNT/PASSWORD,the REQUIRED parameter(s) in .env' +
            '\nsee `cat .env-example` for help',
        args,
    );
console.log(args);
module.exports.args = args;
