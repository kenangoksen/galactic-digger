// game/ConfigCache.js
import COSMIC_PROTOCOLS_CONFIG from "../assets/config/cosmic_protocols.json";
import UNIVERSAL_CONSTANTS_CONFIG from "../assets/config/universal_constant.json";

class ConfigCache {
  constructor() {
    this.universalConstants = UNIVERSAL_CONSTANTS_CONFIG.universal_constants;
    this.cosmicProtocols = COSMIC_PROTOCOLS_CONFIG;
  }

  getUniversalConstants() {
    return this.universalConstants;
  }

  getCosmicProtocols() {
    return this.cosmicProtocols;
  }

  // Helper to get specific constant def
  getConstantDef(id) {
    return this.universalConstants.items.find((c) => c.id === id);
  }

  // Helper to get specific protocol def
  getProtocolDef(id) {
    return this.cosmicProtocols.protocols.find((p) => p.id === id);
  }

  getBigBangFormula() {
      return this.universalConstants.cosmicEssenceEarning;
  }
}

const configCache = new ConfigCache();
export default configCache;
