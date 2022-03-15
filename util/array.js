const R = require('ramda');
const __IIFE_RM_EMPTY_OBJ=(o,p=o,count)=>{
  for(let[k,v]of Object.entries(o)){
    if(R.isEmpty(v))(count.e++,delete o[k])
    else if(R.type(v)=='Object')__IIFE_RM_EMPTY_OBJ(v,p,count)
  }
  if(o!=p&&R.isEmpty(o))__IIFE_RM_EMPTY_OBJ(p,p,count)
}
const _arr = {
  eq:(a,b)=>a.length===b.length&&a.every((v,i)=>Array.isArray(v)?_arr.eq(v,b[i]):v===b[i])
  ,eqSet:(a,b)=>{
    var [aSet,bSet] = [a,b].map(x=>new Set(x.map(JSON.stringify))); // To allow compare array of obj
    return aSet.size===bSet.size&&Array.from(aSet).every(e=>bSet.has(e));
  }
  ,subSet:(a,b)=>[b].map(x=>new Set(x.map(JSON.stringify)))
                    .every(bs=>a.every(ae=>bs.has(JSON.stringify(ae))))
  ,strictSubSet: (a,b)=>{
    var [aSet,bSet] = [a,b].map(x=>new Set(x.map(JSON.stringify))); // To allow compare array of obj
    return Array.from(aSet).every(e=>bSet.has(e))&&Array.from(bSet).some(e=>!aSet.has(e))
  }
  ,cmp: (a,b)=> // return a>b
  a.length === b.length?a.reduce((r,v,i)=>r||(Array.isArray(v)?_arr.cmp(v,b[i]):v-b[i]),0):a.length-b.length
  ,checkVer:(a,b)=>{
    for(const i of Array(Math.min(a.length,b.length)).keys()){
      if(Number(a[i])>Number(b[i]))return true;
      else if(Number(a[i])<Number(b[i]))return false;
    }
    return a.length>b.length
  }
  ,chunk : R.splitEvery
  ,chunk2: R.splitEvery(2)
  ,indexOfminBy : (fn=x=>x)=>(idx,x,i,arr)=> arr[idx]===undefined&&fn(x)!==undefined?i:(fn(x)<fn(arr[idx]))?i:idx
  ,normalizeMut:(arr,key=null,toOne=0)=>{
    var total = 0,xer = toOne?1:Object.keys(arr).length;
    const elem=i=>key?arr[i][key]:arr[i];
    for(i in arr)total+=elem(i)??0;
    for(i in arr)key?
      arr[i][key]??=0:
      arr[i]??=0;
    for(i in arr)key?
      arr[i][key]*=xer/total:
      arr[i]*=xer/total;
    return arr;
  }
  ,normalize:(arr,key,v)=>_arr.normalizeMut(arr.slice(0),key,v)
  ,rmEmpty:o=>{
    const count = {e:0};
    __IIFE_RM_EMPTY_OBJ(o,o,count)
    return count.e
  }
}
/*
const _akmap = {}, _obj={};

const AKM  = require('array-keyed-map');
_akmap.toPlainObject = akmap => {
  const out = {}
  for (const [path, value] of akmap.entries()) {
    setAtPath(out, path, value)
  }
  return out

  function setAtPath (obj, path, value) {
    for (const key of path) obj = obj[key] ??= {}
    obj['__DATA__'] = value
  }
}
_akmap.fromPlainObject = obj => {
  const akmap = new AKM()
  for (const [path, value] of allPaths(obj)) {
    akmap.set(path, value)
  }
  return akmap

  function* allPaths(obj, stack = []) {
    for (let [key, value] of Object.entries(obj)) {
      if (key === '__DATA__') yield [stack, value]
      else yield* allPaths(value, stack.concat([key]))
    }
  }
}

_obj.invert=o=>Object.fromEntries(Object.entries(o).map(x=>[x[1],x[0]]));
_obj.withDefault=(fn=(t,n)=>t.hasOwnProperty?t[n]:0)=>{
  return new Proxy({}, { get: fn });
}
*/

module.exports = {_arr/*,_obj,_akmap*/};
