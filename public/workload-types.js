(function(root) {
  const types = Object.assign(Object.create(null), {
    video: { name: 'Procesare video', ramGb: 2, timeout: 300 },
    python: { name: 'Python', ramGb: 2, timeout: 300 },
    ai: { name: 'AI · CPU', ramGb: 4, timeout: 300 },
    compile: { name: 'Compilare C/C++', ramGb: 2, timeout: 300 },
    simulation: { name: 'Simulări Python', ramGb: 2, timeout: 300 }
  });
  if (typeof module !== 'undefined' && module.exports) module.exports = { types };
  else root.ComputeTypes = types;
})(globalThis);
