/** @type {RtdSubmodule} */
export const subModuleObj = {
  name: 'SirdataRTDModule',
  init: init,
  setBidRequestsData: alterBidRequests
};

function init(config, userConsent) {
	console.log(config);
	console.log(userConsent);
  // do init stuff
  //if (initfailed) return false;
  return true;
}

function alterBidRequests(reqBidsConfigObj, callback, config, userConsent) {
	console.log(reqBidsConfigObj);
	console.log(config);
	console.log(userConsent);
  // do stuff
  // put data in AdUnit.fpd.* or rtd.RTDPROVIDERCODE.*
  callback();
}

submodule('realTimeData', subModuleObj);