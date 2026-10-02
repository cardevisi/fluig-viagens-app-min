const vm = require("node:vm");
const sandbox = { saudacao: "olá" };
vm.createContext(sandbox);
vm.runInContext(`
  function dizer() { return saudacao + " do vm"; }
  var x = 1;
  const y = 2;
`, sandbox);

console.log(typeof sandbox.dizer, sandbox.dizer()); // "function" "olá do vm"
console.log(sandbox.x, sandbox.y); 