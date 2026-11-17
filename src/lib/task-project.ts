export const INBOX_NAME = "Входящие";

export type TaskBoardRef = { id: string; name: string; inbox: boolean };

/**
 * A timing category is meant to live in a project (`catProject`).
 * When that link is missing, the task still saves: «Входящие» unless the
 * form picked another project. An existing link is kept.
 */
export function resolveTaskProject(input: {
  category: string;
  catProject: Record<string, string | undefined>;
  boards: readonly TaskBoardRef[];
  chosen?: string;
}): { project: string; projectId: string; mapped: boolean; hint: string } {
  const mappedName = input.catProject[input.category]?.trim() ?? "";
  const mapped = mappedName.length > 0;
  const wanted = (input.chosen?.trim() || (mapped ? mappedName : INBOX_NAME)).trim() || INBOX_NAME;
  const board =
    input.boards.find((item) => item.name === wanted) ||
    input.boards.find((item) => item.inbox) ||
    input.boards[0];
  return {
    project: board?.name || wanted,
    projectId: board?.id || wanted,
    mapped,
    hint: mapped
      ? ""
      : "У этой категории ещё нет проекта. Можно оставить «Входящие» или выбрать проект здесь.",
  };
}
