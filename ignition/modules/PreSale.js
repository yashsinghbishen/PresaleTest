const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

const tokenModule = buildModule("ICOToken", (m) => {
  const token = m.contract("ICOToken", ["ICOToken", "ICOT"]);
  return { token};
});

module.exports = buildModule("PreSale", (m) => {
    
    const {token} = m.useModule(tokenModule)

    const preSale = m.contract("PreSale", [
      network.config.addresses.weth,
      token,
      network.config.options.threshold,
      network.config.addresses.uniswapRouter,
      network.config.addresses.aerodromeRouter,
      network.config.options.conversionRate,
      network.config.addresses.uncxLock,
      network.config.options.broker,
      network.config.addresses.sablierLiner,
    ]);
    console.log(network.config.addresses.weth,
        token,
        network.config.options.threshold,
        network.config.addresses.uniswapRouter,
        network.config.addresses.aerodromeRouter,
        network.config.options.conversionRate,
        network.config.addresses.uncxLock,
        network.config.options.broker,
        network.config.addresses.sablierLiner,)

    m.call(token, "approve", [preSale,
      network.config.options.threshold * network.config.options.conversionRate])
  
     m.call(preSale, "setTreasury", [m.getAccount(0)]);
  
    return { preSale};
  });

//   module.exports = buildModule("PreSale", (m) => {
//     const token = m.contract("ICOToken", ["ICOToken", "ICOT"]);
//     const preSale = m.contract("PreSale", [
//       network.config.addresses.weth,
//       token,
//       network.config.options.threshold,
//       network.config.addresses.uniswapRouter,
//       network.config.addresses.aerodromeRouter,
//       network.config.options.conversionRate,
//       network.config.addresses.uncxLock,
//       network.config.options.broker,
//       network.config.addresses.sablierLiner,
//     ]);
  
  
//     m.call(token, "approve", [preSale,
//       network.config.options.threshold * network.config.options.conversionRate])
  
//      m.call(preSale, "setTreasury", [m.getAccount(0)]);
  
//     return { token, preSale};
//   });
    
