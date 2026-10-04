// Conservative admission profiles for the bundled scenes, not measured memory quotas.
// Frames run sequentially on each GPU; samples/iterations increase time, not scene size.
(function (root) {
  function requirements(job) {
    const pixels = Number(job.width) * Number(job.height);
    if (job.mode === 'blender') return { minRam: pixels > 1000000 ? 6 : 4, minVram: 4 };
    return { minRam: 2, minVram: 0 };
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { requirements };
  else root.ComputeWorkload = { requirements };
})(typeof globalThis !== 'undefined' ? globalThis : this);
