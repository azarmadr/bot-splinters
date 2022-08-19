const R = require('ramda')
const {log} = require('./dbug')
const fs = require('fs')
module.exports = {
  ...require('./card'),
  ...require('./array'),
  ...require('./dbug'),
  ...require('./score'),
  isLocked:R.pipe(
    String.raw,
    u=>fs.existsSync(u)
    ?fs.statSync(u).mtimeMs+81e4>Date.now()||fs.unlinkSync(u)||fs.writeFileSync(u,'')
    :fs.writeFileSync(u,''),
  ),
  refreshLock:R.pipe(
    String.raw,
    R.juxt ([
      R.tryCatch(fs.unlinkSync,log),
      f=>fs.writeFileSync(f,``)
    ])
  ),
  rmLock: R.pipe(
    String.raw,
    R.tryCatch(fs.unlinkSync,log)
  )
}
