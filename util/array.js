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
    var total = 0,xer = toOne?1:Object.keys(arr).filter(k=>key?arr[k][key]:arr[k]).length;
    const elem=i=>key?arr[i][key]:arr[i];
    for(i in arr)total+=elem(i)??0;
    if(!total)return arr;
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

module.exports = {_arr};
