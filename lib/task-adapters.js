// Each adapter owns execution; scheduling, transfers and credits remain shared.
const adapters = {
  fractal: (agent, task) => agent.cpu(task),
  raytrace: (agent, task) => agent.cpu(task),
  blender: (agent, task) => agent.renderGpuFrame(task),
  'blender-project': async (agent, task) => {
    const projectPath = await agent.downloadProject(task.project);
    if (!agent.running || agent.active.get(task.lease)?.cancelled) throw new Error('Sarcina a fost anulată');
    return agent.renderGpuFrame({ ...task, projectPath });
  }
};
for (const kind of Object.keys(require('../public/workload-types').types)) adapters[kind] = (agent, task) => require('./container-runtime').run(agent, task);
async function execute(agent, task) {
  const run = adapters[task.adapter || task.mode];
  if (!run) throw new Error('Acest PC nu are adaptorul necesar lucrării');
  return run(agent, task);
}
module.exports = { execute, adapters };
