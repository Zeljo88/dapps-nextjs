// Local-only fixture for cache, outage and epoch freshness regression checks.
import http from 'node:http';
const port=Number(process.env.MOCK_API_PORT||18081);
const baseline=1793483091, duration=432000;
const currentStart=baseline+Math.floor((Date.now()/1000-baseline)/duration)*duration;
const currentEpoch=665+Math.floor((currentStart-baseline)/duration);
const digest='local-regression-registry';
const names=[['minswap','Minswap',24726,1911],['sundaeswap','SundaeSwap',3540,451],['wingriders','WingRiders',340,104]];
const controls={offline:false,stale:false,registry:digest,transactions:7,epoch:currentEpoch};
const counts={};
const now=()=>Date.now()/1000;
const status=()=>({fresh:true,phase:'running',startedAt:currentStart,lastReceivedAt:now()-(controls.stale?181:5),checkpoint:{height:100,slot:100,time:now()-5,epoch:controls.epoch,hash:'local'},watchedScripts:3,lagBlocks:0,registryDigest:controls.registry,counts:{blocks:100,transactions:1000},methodology:'Local test fixture'});
const dapps=()=>names.map(([slug,name])=>({slug,name,category:'DEFI',subCategory:'AMM_DEX',description:'Local regression fixture; never deployed as real data.',website:'https://example.com',coverage:'partial',source:'https://example.com',mappingReviewedOn:'2026-11-01',scripts:[{hash:'abc',role:'V1 orders'}],observedTransactions:50000,observedTx24h:10,observedEpoch:controls.epoch,observedTxEpoch:controls.transactions,epochRecordedSince:currentStart,recordedSince:currentStart,lastObservedActivity:now()-5,confirmationDepth:3,fresh:true}));
const history={registryDigest:digest,aggregation:'epoch',coverage:'partial',epochs:Array.from({length:6},(_,i)=>({epoch:currentEpoch-6+i,startTime:currentStart-(6-i)*duration,endTime:currentStart-(5-i)*duration,dapps:names.map(([slug,name,transactions,activeWallets])=>({slug,name,transactions,activeWallets,walletActivity:{method:'fixture',candidateOrderOutputs:2000,attributedOrderOutputs:1999,attributionPercent:99.95}})),validation:{passed:true,checkedAt:'2026-11-01T00:00:00Z',blocksReplayed:20000,independentTransactionSamples:5,chainTransactionsInspected:100000}}))};
function send(response,body,code=200){response.writeHead(code,{'content-type':'application/json','cache-control':'no-store'});response.end(JSON.stringify(body));}
const server=http.createServer(async(request,response)=>{
 const url=new URL(request.url,'http://127.0.0.1');
 if(url.pathname==='/__counts')return send(response,counts);
 if(url.pathname==='/__control'&&request.method==='POST'){
  let body='';for await(const chunk of request)body+=chunk;
  Object.assign(controls,JSON.parse(body));return send(response,controls);
 }
 counts[url.pathname]=(counts[url.pathname]||0)+1;
 if(url.pathname.startsWith('/__tvl/')){
  const slug=url.pathname.split('/').at(-1),id=slug==='minswap-dex'?'1494':slug==='sundaeswap'?'parent#sundaeswap':'1601';
  return send(response,{id,chainTvls:{Cardano:{tvl:[...history.epochs.map(epoch=>({date:epoch.endTime-3600,totalLiquidityUSD:1000000})),{date:Math.floor(now())-60,totalLiquidityUSD:1100000}]}},tokens:{discarded:'x'.repeat(100000)}});
 }
 if(controls.offline)return send(response,{error:'Simulated relay outage'},503);
 if(url.pathname==='/v1/status')return send(response,status());
 if(url.pathname==='/v1/dapps')return send(response,dapps());
 if(url.pathname==='/v1/history')return send(response,history);
 if(/^\/staging\/v1\/dapps\/[^/]+\/metrics$/.test(url.pathname)){
  const slug=url.pathname.split('/')[4];
  return send(response,{source:'own-cardano-node',registryDigest:digest,slug,generatedAt:now(),confirmationDepth:3,epochs:history.epochs.map(epoch=>({...epoch,...epoch.dapps.find(d=>d.slug===slug),orderOutputsCreated:2000,networkTransactions:100000,transactionSharePercent:1,walletVersions:[{version:'V1',activeWallets:100}]})),recorded:{fromTime:currentStart,throughTime:now()-60,confirmedHeight:97,fresh:true,transactions:7,networkFeesLovelace:'1000001',averageNetworkFeeAda:'0.142857',outputsCreated:15,outputsSpent:8,versionTransactions:[{version:'V1',transactions:7}],observedLovelace:'100000000',observedUnspentOutputs:7,assetCount:1,assetsLimit:20,assets:[{policyId:'a'.repeat(56),assetNameHex:'41',quantity:'12345678901234567890'}]}});
 }
 if(url.pathname==='/dapps/list-dapps')return send(response,[]);
 return send(response,{error:'not found'},404);
});
server.listen(port,'127.0.0.1',()=>console.log(`Local analytics fixture http://127.0.0.1:${port}; current epoch ${currentEpoch}`));
