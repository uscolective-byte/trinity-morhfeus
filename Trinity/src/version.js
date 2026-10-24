export const TRINITY_VERSION='11.0.0';

export const TRINITY_SOURCE={repository:'uscolective-byte/Trinity-antigravity',branch:'main'};

export function sourceMetadata(env){
  return {repository:env.TRINITY_GITHUB_REPO||TRINITY_SOURCE.repository,branch:env.TRINITY_GITHUB_BRANCH||TRINITY_SOURCE.branch};
}

export function releaseMetadata(env){
  const version=env.CF_VERSION_METADATA;
  return {id:version?.id||null,tag:version?.tag||null,timestamp:version?.timestamp||null};
}
