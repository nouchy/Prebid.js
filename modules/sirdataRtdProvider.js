/**
 * This module adds Sirdata provider to the real time data module
 * The {@link module:modules/realTimeData} module is required
 * The module will fetch segments (user-centric) and categories (page-centric) from Sirdata server
 * The module will automatically handle user's privacy and choice in California (IAB TL CCPA Framework) and in Europe (IAB EU TCF FOR GDPR)
 * @module modules/sirdataRtdProvider
 * @requires module:modules/realTimeData
 */
import {getGlobal} from '../src/prebidGlobal.js';
import * as utils from '../src/utils.js';
import {submodule} from '../src/hook.js';
import {ajax} from '../src/ajax.js';

/** @type {string} */
const MODULE_NAME = 'realTimeData';
const SUBMODULE_NAME = 'SirdataRTDModule';

const set = (obj, path, val) => {
  const keys = path.split('.');
  const lastKey = keys.pop();
  const lastObj = keys.reduce((obj, key) => obj[key] = obj[key] || {}, obj);
  lastObj[lastKey] = lastObj[lastKey] || val;
};

export function getSegmentsAndCategories(reqBidsConfigObj, onDone, config, userConsent) {
  const gobalConfig = getGlobal();
  const adUnits = reqBidsConfigObj.adUnits || gobalConfig.adUnits;
  config.params = config.params || {};

  var tcString = (userConsent && userConsent.gdpr && userConsent.gdpr.consentString ? userConsent.gdpr.consentString : '');
  var gdprApplies = (userConsent && userConsent.gdpr && userConsent.gdpr.gdprApplies ? userConsent.gdpr.gdprApplies : '');
  var sirdataDomain = 'sddan.com';
  var sendWithCredentials = true;

  config.params.partnerId = config.params.partnerId ? config.params.partnerId : 1;
  config.params.key = config.params.key ? config.params.key : 1;

  if (userConsent.coppa) { // if children, no segments, page categories only
    sirdataDomain = 'cookieless-data.com';
    tcString = '';
    sendWithCredentials = false;
  } else if (userConsent.usp) {
    // Si pas de transprence ou optout on passe en contextuel seulement
    if (userConsent.usp[0] == '1' && (userConsent.usp[1] == 'N' || userConsent.usp[2] == 'Y')) {
      sirdataDomain = 'cookieless-data.com';
      sendWithCredentials = false;
      gdprApplies = false;
    }
  } else if (gdprApplies && gdprApplies !== '0' && gdprApplies !== 'null') {
    if (userConsent && userConsent.gdpr && userConsent.gdpr.vendorData && userConsent.gdpr.vendorData.vendor && userConsent.gdpr.vendorData.vendor.consents) {
      if (!userConsent.gdpr.vendorData.vendor.consents[53] || !userConsent.gdpr.vendorData.purpose.consents[1] || !userConsent.gdpr.vendorData.purpose.consents[3]) {
        sirdataDomain = 'cookieless-data.com';
        sendWithCredentials = false;
      }
    }
  }

  var actualUrl = null;
  try {
    actualUrl = window.top.location.href;
  } catch (e) {}

  const url = 'https://kvt.' + sirdataDomain + '/api/v1/public/p/' + config.params.partnerId + '/d/' + config.params.key + '/s?callback=&gdpr=' + gdprApplies + '&gdpr_consent=' + tcString + (actualUrl ? '&url=' + actualUrl : '');
  ajax(url, {
    success: function (response, req) {
      if (req.status === 200) {
        try {
          const data = JSON.parse(response);
          if (data && data.segments) {
            addSegmentData(adUnits, data, config, onDone, gobalConfig);
          } else {
            onDone();
          }
        } catch (err) {
          utils.logError('unable to parse Sirdata segment data');
          onDone();
        }
      } else if (req.status === 204) {
        // unrecognized partner config
        onDone();
      }
    },
    error: function () {
      onDone();
      utils.logError('unable to get Sirdata segment data');
    }
  },
  null,
  {
    contentType: 'text/plain',
    method: 'GET',
    withCredentials: sendWithCredentials,
    referrerPolicy: 'unsafe-url',
    crossOrigin: true
  });
}

export function setBidderOrtb2(bid, segments, categories, gobalConfig) {
  var ortb2Valid = true;

  try {
    if (parseFloat(gobalConfig.version.substring(1)) < 4.3) {
      ortb2Valid = false;
    }
  } catch (er) {}

  if (!ortb2Valid) {
    return setBidderFpd(bid, segments, categories);
  }

  try {
    gobalConfig.setBidderConfig({
      bidders: [bid.bidder],
      config: {
        ortb2: {
          site: {
            ext: {
              data: {
                sd_rtd: categories
              }
            }
          },
          user: {
            ext: {
              data: {
                sd_rtd: segments
              }
            }
          }
        }
      }
    });
  } catch (err) {
    utils.logError(err.message)
  }
  return !0
}

export function setBidderFpd(bid, segments, categories) {
  return !0
}

export function loadCustomFunction (config, adUnit, list, data, bid) {
  try {
    if (config.params.custom[bid.bidder]) {
      config.params.custom[bid.bidder](adUnit, list, data);
    } else if (config.params.custom[adUnit.code]) {
      config.params.custom[adUnit.code](adUnit, list, data);
    }
  } catch (er) {}
  return !0
}

export function addSegmentData(adUnits, data, config, onDone, gobalConfig) {
  utils.logInfo(gobalConfig);
  utils.logInfo(adUnits);
  utils.logInfo(data);
  utils.logInfo(config);
  config.params = config.params || {};
  config.params.contextualMinRelevancyScore = config.params.contextualMinRelevancyScore ? config.params.contextualMinRelevancyScore : 30;
  var list = [];
  var segments = [];
  var categories = [];
  try {
    if (data && data.contextual_categories && config.params.contextualMinRelevancyScore) {
      Object.entries(data.contextual_categories).forEach(([cat, value]) => {
        if (value >= config.params.contextualMinRelevancyScore && list.indexOf(cat) === -1) {
          list.push(cat);
          categories.push(cat);
        }
      });
    }
  } catch (e) {}
  utils.logInfo(list);
  try {
    if (data && data.segments) {
      Object.entries(data.segments).forEach(([entry, segment]) => {
        if (list.indexOf(segment) === -1) {
          list.push(segment);
          segments.push(segment);
        }
      });
    }
  } catch (e) {}
  utils.logInfo(list);
  if (!list || list.length < 1) { onDone(); return; }

  if (typeof window.googletag !== 'undefined' && config.params.setGptKeyValues) {
    utils.logInfo('Set GPT Targeting');
    /* window.googletag.cmd.push(function () {
      window.googletag.pubads().setTargeting('sd_rtd', list);
    });
    */
    window.googletag.pubads().getSlots().forEach(function(n) {
      if (typeof n.setTargeting !== 'undefined') {
        utils.logInfo('Set GPT Targeting : done');
        n.setTargeting('sd_rtd', list);
      }
    })
  }

  adUnits.forEach(adUnit => {
    adUnit.hasOwnProperty('bids') && adUnit.bids.forEach(bid => {
      if (!config.params.bidders || (config.params.bidders && config.params.bidders.indexOf(bid.bidder) !== -1 && (!config.params.adUnitCodes || config.params.adUnitCodes.indexOf(adUnit.code) !== -1))) {
        if (config.params.custom && typeof config.params.custom[bid.bidder] == 'function') {
          loadCustomFunction(config, adUnit, list, data, bid);
        } else if (bid.bidder == 'appnexus') {
          var keywords = {};
          if (bid.params.keywords !== undefined) {
            keywords = bid.params.keywords;
          }
          try {
            keywords.sd_rtd = list;
            set(bid, 'params.keywords', keywords);
            set(bid, 'params.user.segments', list);
          } catch (err) {
            utils.logError(err.message)
          }
        } else if (bid.bidder == 'smartadserver') {
          var target = [];
          if (bid.params.target !== undefined) {
            target.push(bid.params.target);
          }
          try {
            list.forEach(function(entry) {
              if (target.indexOf('sd_rtd=' + entry) === -1) {
                target.push('sd_rtd=' + entry);
              }
            });
            set(bid, 'params.target', target.join(';'));
          } catch (err) {
            utils.logError(err.message)
          }
        } else if (bid.bidder == 'ix') {
          try {
            var ixConfig = bid.firstPartyData || {};
            var newFpd = {'sd_rtd': list};
            newFpd = Object.assign(ixConfig, newFpd);
            gobalConfig.setConfig({
              ix: {
                firstPartyData: newFpd
              }
            });
          } catch (err) {
            utils.logError(err.message)
          }
        } else if (bid.bidder == 'rubicon') {
          setBidderOrtb2(bid, segments, categories, gobalConfig);
        }
      }
    })
  });

  onDone();
  return adUnits;
}

export function init(config) {
  return true;
}

export const subModuleObj = {
  name: SUBMODULE_NAME,
  init: init,
  getBidRequestData: getSegmentsAndCategories
};

submodule(MODULE_NAME, subModuleObj);
