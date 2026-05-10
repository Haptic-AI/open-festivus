/**
 * Seed data types — re-exports from @festivus/types.
 *
 * BEFORE: This file had its own parallel type hierarchy (IRobotEntry, IPolicyEntry, etc.)
 * that duplicated @festivus/types with different field names.
 *
 * NOW: Single source of truth. Seed JSON files conform to the same types
 * the API serves. No conversion layer needed.
 *
 * If you need to add a field: update @festivus/types FIRST, then update
 * the JSON files, then pnpm check will tell you what else to fix.
 */

export type {
  IRobot as IRobotEntry,
  IPolicy as IPolicyEntry,
  IEnvironment as IEnvironmentEntry,
  IDataset as IDatasetEntry,
  IPaper as IPaperEntry,
  ITask as ITaskEntry,
  ICompatibilityEdge,
  IDeployNoteEntry,
  IDeployNotesByType as IDeployNotes,
  IBuildPath,
  IActionSpace,
  IObservationSpace,
  IBenchmark,
  IEnvironmentConditions,
} from "@festivus/types"

// Combined seed data shape for loaders
import type {
  IRobot,
  IPolicy,
  IEnvironment,
  IDataset,
  IPaper,
  ITask,
  IDeployNotesByType,
} from "@festivus/types"

export interface ISeedData {
  robots: IRobot[]
  policies: IPolicy[]
  environments: IEnvironment[]
  datasets: IDataset[]
  papers: IPaper[]
  tasks: ITask[]
  deployNotes: IDeployNotesByType
}
