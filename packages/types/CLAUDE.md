# @festivus/types

Shared TypeScript interfaces for the monorepo. No runtime code, no dependencies
(except type-only usage).

## Conventions

- All interfaces prefixed with `I` (e.g., `ICanvasNode`, `IProjectStore`)
- All types prefixed with `I` (e.g., `IEvidenceLevel`, `ISkillType`)
- Use `export type` for type aliases, `export interface` for object shapes
- No Zod, no runtime validation here -- Zod schemas live in `apps/web`
- This package is consumed via `@festivus/types` (workspace link)

## Key type groups

- **Hardware/Sensors**: `IHardware`, `ISensor`, `IActuator`
- **Policies**: `IPolicy`, `IPolicyDetail`, `ICompatibilityEntry`
- **Robots**: `IRobot`
- **Datasets**: `IDataset`
- **Workbench state**: `ICanvasNode`, `IConnection`, `IAgentMessage`, `ISnapshot`, `ITrayItem`
- **Persistence**: `IPersistedWorkbenchState`, `IProjectSummary`, `IProjectStore`
- **Auth**: `IUser`, `IAuthProvider`
