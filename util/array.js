const _arr = {
  eq:(a,b)=>a.length===b.length&&a.every((v,i)=>Array.isArray(v)?_arr.eq(v,b[i]):v===b[i])
  ,eqSet:(a,b)=>{
    var [aSet,bSet] = [a,b].map(x=>new Set(x.map(JSON.stringify))); // To allow compare array of obj
    return aSet.size===bSet.size&&Array.from(aSet).every(e=>bSet.has(e));
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
  ,chunk : (arr, n) => {
    if(n<=0)throw new Error('First argument to splitEvery must be a positive integer')
    var result = [],idx = 0;
    while(idx<arr.length)result.push(arr.slice(idx,idx+=n))
    return result
  }
  ,chunk2:arr=>_arr.chunk(arr,2)
  ,indexOfminBy : (fn=x=>x)=>(idx,x,i,arr)=> arr[idx]===undefined&&fn(x)!==undefined?i:(fn(x)<fn(arr[idx]))?i:idx
  ,normalizeMut:arr=>{
    var total = 0;
    for(i in arr)total+=arr[i];
    for(i in arr)arr[i]=arr[i]/total;
    return arr;
  }
  ,normalize:arr=>_arr.normalizeMut(arr.slice(0))
}
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

module.exports = {_arr,_obj,_akmap};
_obj.invert=o=>Object.fromEntries(Object.entries(o).map(x=>[x[1],x[0]]));
_obj.withDefault=(fn=(t,n)=>t.hasOwnProperty?t[n]:0)=>{
  return new Proxy({}, { get: fn });
}
