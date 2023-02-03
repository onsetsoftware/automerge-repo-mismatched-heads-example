import type { Commit, EntityState } from "./automerge-store";

export const branchCommitsBetween = (
  commits: EntityState<Commit>,
  branchId: string,
  start: string | null,
  end: string | null
): Commit[] => {
  const startIndex = start ? commits.ids.indexOf(start) : 0;
  const endIndex = end ? commits.ids.indexOf(end) : commits.ids.length - 1;

  return commits.ids
    .slice(startIndex + 1, endIndex)
    .map((id) => commits.entities[id])
    .filter((commit) => commit.branch === branchId);
};

export type BranchPair = {
  from: string;
  to: string;
  start: string;
  end: string;
  fromCommits: Commit[];
  toCommits: Commit[];
};

export type BranchPairs = {
  [branchId: string]: BranchPair[];
};

export const branchMergePairs = (commits: EntityState<Commit>) => {
  return Object.values(
    Object.values(commits.entities)
      .filter((commit) => commit.forks.length > 0 || commit.merges.length > 0)
      .reduce((branches: BranchPairs, commit) => {
        if (!branches[commit.branch]) {
          branches[commit.branch] = [];
        }
        if (commit.forks.length > 0) {
          for (const fork of commit.forks) {
            branches[commit.branch].push({
              from: commit.branch,
              to: fork,
              start: commit.head,
              end: null,
              fromCommits: [],
              toCommits: [],
            });
          }
        }

        if (commit.merges.length > 0) {
          for (const merge of commit.merges) {
            const possiblePairs = branches[commit.branch].filter(
              (pair) =>
                pair.to === merge &&
                pair.end === null &&
                pair.start !== commit.head
            );

            if (possiblePairs.length > 0) {
              possiblePairs[0].end = commit.head;
            }
          }
        }

        return branches;
      }, {})
  )
    .flat()
    .filter((pair) => pair.end !== null)
    .map((pair) => {
      pair.fromCommits = branchCommitsBetween(
        commits,
        pair.from,
        pair.start,
        pair.end
      );
      pair.toCommits = branchCommitsBetween(
        commits,
        pair.to,
        pair.start,
        pair.end
      );
      return pair;
    });
};
