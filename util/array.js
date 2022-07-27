const R = require('ramda');
const __IIFE_RM_EMPTY_OBJ = (o,p=o,count)=>{
  for (let[k,v] of Object.entries(o)) {
    if (R.isEmpty(v))
      (count.e++,
      delete o[k])
    else if (R.type(v) == 'Object')
      __IIFE_RM_EMPTY_OBJ(v, p, count)
  }
  if (o != p && R.isEmpty(o))
    __IIFE_RM_EMPTY_OBJ(p, p, count)
}
const _arr = {
  eq: (a,b)=>a.length === b.length && a.every((v,i)=>Array.isArray(v) ? _arr.eq(v, b[i]) : v === b[i]),
  eqSet: (a,b)=>{
    var [aSet,bSet] = [a, b].map(x=>new Set(x.map(JSON.stringify)));
    // To allow compare array of obj
    return aSet.size === bSet.size && Array.from(aSet).every(e=>bSet.has(e));
  }
  ,
  subSet: (a,b)=>[b].map(x=>new Set(x.map(JSON.stringify))).every(bs=>a.every(ae=>bs.has(JSON.stringify(ae)))),
  strictSubSet: (a,b)=>{
    var [aSet,bSet] = [a, b].map(x=>new Set(x.map(JSON.stringify)));
    // To allow compare array of obj
    return Array.from(aSet).every(e=>bSet.has(e)) && Array.from(bSet).some(e=>!aSet.has(e))
  }
  ,
  cmp: (a,b)=>// return a>b
  a.length === b.length ? a.reduce((r,v,i)=>r || (Array.isArray(v) ? _arr.cmp(v, b[i]) : v - b[i]), 0) : a.length - b.length,
  checkVer: (a,b)=>{
    for (const i of Array(Math.min(a.length, b.length)).keys()) {
      if (Number(a[i]) > Number(b[i]))
        return true;
      else if (Number(a[i]) < Number(b[i]))
        return false;
    }
    return a.length > b.length
  }
  ,
  chunk: R.splitEvery,
  chunk2: R.splitEvery(2),
  indexOfminBy: (fn=x=>x)=>(idx,x,i,arr)=>arr[idx] === undefined && fn(x) !== undefined ? i : (fn(x) < fn(arr[idx])) ? i : idx,
  normalizeMut: (arr,path=null,opt=0)=>{
    var p = path ? i=>R.path([i, path], arr) : i=>arr[i];
    var total = 0
      , min = Number.MAX_VALUE
      , max = Number.MIN_VALUE;
    if (opt < 2) {
      for (let i in arr)
        total += p(i) ?? 0;
      if (!total)
        return arr;
    } else {
      for (let i in arr) {
        min = Math.min(p(i) ?? 0, min);
        max = Math.max(p(i) ?? 0, max);
      }
    }
    let {num, den} = {
      0: {
        num: i=>p(i) ?? 0,
        den: total
      },
      1: {
        num: i=>(p(i) ?? 0) * Object.keys(arr).filter(p).length,
        den: total
      },
      2: {
        num: i=>(p(i) ?? 0) - min,
        den: max - min
      }
    }[opt];
    if (path) {
      for (let i in arr) {
        let value = num(i) / den;
        arr[i][path] = value;
      }
    } else {
      for (let i in arr) {
        let value = num(i) / den;
        arr[i] = value;
      }
    }
    delete arr['@@functional/placeholder']
    return arr;
  }
  ,
  normalize: (arr,path,v)=>_arr.normalizeMut(arr.slice(0), path, v),
  rmEmpty: o=>{
    const count = {
      e: 0
    };
    __IIFE_RM_EMPTY_OBJ(o, o, count)
    return count.e
  }
}

module.exports = {
  _arr
};
