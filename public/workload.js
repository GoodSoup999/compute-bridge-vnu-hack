// Conservative admission profiles for the bundled scenes, not measured memory quotas.
// Frames run sequentially on each GPU; samples/iterations increase time, not scene size.
(function (root) {
  function requirements(job) {
    const profiles = typeof module !== 'undefined' && module.exports ? require('./workload-types').types : root.ComputeTypes;
    if (profiles?.[job.mode]) return { minRam: profiles[job.mode].ramGb, minVram: 0 };
    const pixels = Number(job.width) * Number(job.height);
    if (job.mode === 'blender') return { minRam: pixels > 1000000 ? 6 : 4, minVram: 4 };
    return { minRam: 2, minVram: 0 };
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { requirements };
  else root.ComputeWorkload = { requirements };
})(typeof globalThis !== 'undefined' ? globalThis : this);
