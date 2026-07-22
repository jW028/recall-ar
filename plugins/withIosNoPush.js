const { withEntitlementsPlist } = require('expo/config-plugins');

// Removes the iOS APNs entitlement that expo-notifications always injects,
// so iOS can build/sign with a free Apple Developer account. Android is unaffected.
module.exports = function withIosNoPush(config) {
  return withEntitlementsPlist(config, (cfg) => {
    delete cfg.modResults['aps-environment'];
    return cfg;
  });
};
