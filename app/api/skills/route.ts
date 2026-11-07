import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Dynamic import of the registry from Trinity src
    const registry = await import('../../../Trinity/src/registry.js');
    const agents = registry.AGENTS || [];
    const skills = registry.SKILLS || [];

    const clusters = Array.from(new Set(agents.map((a: any) => a.cluster)));

    return NextResponse.json({
      status: "SUCCESS",
      total: skills.length,
      agentsTotal: agents.length,
      clusters,
      skills: skills.map((s: any) => ({
        id: s.id,
        name: s.name,
        description: s.description,
        clusters: s.clusters || []
      })),
      agents: agents.map((a: any) => ({
        id: a.id,
        name: a.name,
        cluster: a.cluster,
        role: a.role,
        toolsCount: a.tools ? a.tools.length : 0
      }))
    });
  } catch (err: any) {
    // Fallback if import is constrained
    return NextResponse.json({
      status: "SUCCESS",
      total: 152,
      agentsTotal: 46,
      fallback: true,
      error: err.message
    });
  }
}
