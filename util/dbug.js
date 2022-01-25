const _dbug = {},_func={},_elem={};

const rl = require("readline");
try{
  rl.emitKeypressEvents(process.stdin);
  var _wake;
  const rlInterface=rl.createInterface({input:process.stdin,output:process.stdout});
  rlInterface.pause();
  process.stdin.on('keypress',(_,k)=>{
    _wake=1; rlInterface.pause();
    rl.moveCursor(process.stdout,0,(k&&k.name=='return')?-1:0);
  });

  function sleep(ms,msg='') {
    rlInterface.resume();
    process.stdout.write("\x1B[?25l");
    [...Array(27).keys()].forEach(()=>process.stdout.write("\u2591"))
    rl.cursorTo(process.stdout, 0);
    return [...Array(27).keys()].reduce((memo,e)=>memo.then(async()=>{
      process.stdout.write("\u2588");
      if(e==26){
        rl.clearLine(process.stdout,0)&&rl.cursorTo(process.stdout,0);
        if(msg)console.log(msg);
        _wake=0; rlInterface.pause();
      }
      if(_wake&&e<27)return;
      return new Promise((resolve) => setTimeout(resolve, ms/27));
    }),Promise.resolve())
  }
}catch(e){console.log(e)}
_dbug.timer =class{
  constructor(){this.t=Date.now()}
  get d(){log(this._d/1e3);}
  get _d(){
    const t = Date.now()-this.t;
    this.t=Date.now();
    return t
  }
}
const _logTimer = new _dbug.timer();
const log=(...m)=>console.log(_logTimer._d,(new Error()).stack.split("\n").find((c,i)=>
  !c.includes('_dbug')&&i==2||!c.includes('tt')&&i==3||i==4).match(/[^:\\/]+:\d+/)?.[0],...m);

_dbug.in1 =(...m)=>{
  rl.clearLine(process.stdout,0)
  rl.cursorTo(process.stdout,0);
  process.stdout.write(`tt: ${m}`);
}
_dbug.table = m => {
  const toFixed = o => {
    for(k in o)isNaN(o[k])?typeof(o[k])=='object'&&toFixed(o[k]):o[k]=Number(Number(o[k]).toFixed(3));
  }
  toFixed(m);console.table(m);
  try{rl.moveCursor(process.stdout,0,-1);log();}catch(e){console.warn(e)}
}
_dbug.tt = new Proxy({},{
  set: (obj, prop, v)=>{
    if(obj.hasOwnProperty(prop))obj[prop].push(v);
    else obj[prop] = [v];
  },
  deleteProperty: (obj, prop)=>{if(prop in obj){
    _dbug.table(obj[prop]);
    delete obj[prop];
  }}
});
_func.retryFor=(n,to,continueAfterAllRetries=0,func,err='')=>{
  if(!--n){
    log({'Failed after multiple retries':''});
    if(continueAfterAllRetries)return Promise.resolve(err);
    else return Promise.reject(err);
  }
  return func().catch(async err=>{
    log({'nth retry':n})
    await sleep(to).then(()=>
      _func.retryFor(n,to,continueAfterAllRetries,func,err))
  })
}

_elem.click = async function(page, selector, timeout = 20000, delayBeforeClicking = 0) {
  try {
    const elem = await page.waitForSelector(selector, { timeout });
    if (elem) {
      await sleep(delayBeforeClicking);
      await elem.click();
      return selector;
    }
  } catch (e) {/*log(e)*/}
  log('Error: Could not find element ' + selector);
  return false;
}
_elem.getText = async function(page, selector, timeout=20000) {
  const element = await page.waitForSelector(selector,  { timeout });
  const text = await element.evaluate(el => el.textContent);
  return text;
}
_elem.getTextByXpath = async function(page, selector, timeout=20000) {
  const element = await page.waitForXPath(selector,  { timeout });
  const text = await element.evaluate(el => el.textContent);
  return text;
}

module.exports = {log,sleep, _dbug, _func, _elem,}
