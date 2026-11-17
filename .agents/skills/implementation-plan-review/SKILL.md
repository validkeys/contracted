---
name: implementation-plan-review
description: Reviews generated implementation plans against best practices including task sizing (30m-2.5h), style anchors, TDD requirements (AI audience), drift prevention (AI audience), and quality constraints. Validates milestones.yaml and task files for completeness, alignment, and development readiness. Adjusts review criteria based on target audience (AI, human, or hybrid).
---

# Implementation Plan Review

This skill reviews generated implementation plans against established best practices to ensure quality, completeness, and development readiness.

## Prerequisites

- Generated `milestones.yaml` file
- Associated `milestone-m*.tasks.yaml` files
- Optional: Source business-requirements.yaml and technical-requirements.yaml for alignment checks

## Review Process

### Phase 1: Structure Validation

Load and parse all plan files:

1. **File Discovery**
   - Locate `milestones.yaml`
   - Find all `milestone-m*.tasks.yaml` files
   - Verify all referenced task files exist

2. **Schema Validation**
   - Validate YAML syntax
   - Check required fields present
   - Verify data types and formats

3. **Reference Integrity**
   - Validate milestone dependencies exist
   - Validate task dependencies exist
   - Check task file references match milestones

### Phase 2: Best Practices Compliance

Review against embedded best practices. **Note:** Some checks vary by target audience:
- **AI audience:** Expect full TDD checklists, drift policy, explicit step-by-step instructions
- **Human audience:** Expect high-level objectives, constraints, and success criteria only
- **Hybrid audience:** Expect moderate detail with key guidance points

Adjust expectations accordingly when reviewing instruction detail level.

#### Target Audience Validation

- [ ] **Metadata includes target_audience** — milestones.yaml has meta.target_audience field
- [ ] **Valid audience value** — one of: "ai", "human", "hybrid"
- [ ] **Instruction detail matches audience** — review sample tasks to verify:
  - AI: includes implementation steps, TDD checklist, explicit constraints, drift policy
  - Human: includes objective, style anchors, key requirements, success criteria only
  - Hybrid: includes objective, style anchors, implementation approach, validation guidance
- [ ] **Consistency across tasks** — all tasks follow the same detail level

#### Task Summaries

- [ ] **task_summaries section present** at top of each milestone-m*.tasks.yaml
- [ ] **All tasks have summaries** (every task ID in tasks array has a corresponding entry)
- [ ] **Summaries are concise** (20-300 characters, typically 1-2 sentences)
- [ ] **Plain English** (not technical jargon or implementation details)
- [ ] **Active voice** ("Creates X", not "X is created")
- [ ] **Focus on what/why** not how
- [ ] **Scannable overview** - reading summaries alone gives sense of milestone scope

#### Style Anchors

- [ ] **2-3 style anchors included** per milestone task file
- [ ] **Concrete file paths** (not abstract descriptions)
- [ ] **Specific line numbers** provided
- [ ] **Complete examples** (code + tests + README where applicable)
- [ ] **Current patterns** reflecting best practices
- [ ] **Clear descriptions** explaining what pattern is demonstrated

#### Task Sizing (from task-sizing.md)

- [ ] **Minimum 30 minutes** per task (document rationale if smaller)
- [ ] **Optimal 30-150 minutes** for most tasks
- [ ] **Maximum 150 minutes** (2.5 hours) - split if larger
- [ ] **Limited file scope** (1-3 files preferred, >5 requires justification)
- [ ] **Clear deliverables** for each task
- [ ] **Acceptance tests** defined

#### TDD Requirements (AI audience only)

- [ ] **TDD checklist included** for code tasks — **AI only**
- [ ] **Test-first approach** specified — **AI only**
- [ ] **Validation commands** provided — **AI/Hybrid: explicit**, **Human: general guidance**
- [ ] **Expected outputs** documented — **AI only**
- [ ] **Test modification forbidden** when tests fail — **AI only**

For Human/Hybrid audiences, verify success criteria include testing requirements without prescriptive TDD checklists.

#### Affirmative Instructions

- [ ] **Permitted actions explicit** (e.g., "ONLY use: X, Y, Z") — **AI/Hybrid only**
- [ ] **Constraints clear and actionable** — **All audiences**

#### Drift Prevention (AI audience only)

- [ ] **Drift policy stated** in task instructions — **AI only**
- [ ] **Stop criteria clear** (unexpected dependencies, file scope violations) — **AI only**
- [ ] **Revert instructions** provided — **AI only**
- [ ] **Incident documentation** process specified — **AI only**
- [ ] **Allowed deviations** understood (formatting, whitespace) — **AI only**

Human/Hybrid audiences should still have clear constraints but not explicit drift policies.

#### Quality Gates

- [ ] **Pre-commit hooks** defined
- [ ] **Validation commands** specified per task
- [ ] **Success criteria** measurable
- [ ] **Failure handling** documented

#### Prompt Positioning

- [ ] **Critical specs at beginning** of task instructions
- [ ] **Style anchors early** in task definitions
- [ ] **Hard rules reiterated** at end
- [ ] **Requirements not buried** in middle

### Phase 3: Drift Policy Compliance

Review against embedded drift policy:

#### Stop & Revert Criteria Coverage

Check that tasks include guidance for:

- [ ] **New dependencies detection** - How to identify unauthorized dependencies
- [ ] **File scope violations** - What to do if >3 unexpected files touched
- [ ] **Linting/type errors** - Handling unresolvable errors
- [ ] **Test failures** - Policy on modifying vs fixing implementation

#### Immediate Actions Documentation

- [ ] **Stop instruction clear** - "STOP immediately" language used
- [ ] **Error message format** - How to summarize deviation
- [ ] **Revert process** - When and how to revert
- [ ] **Incident note location** - Where to document (docs/drift-incidents/)

#### Recording Learnings

- [ ] **Rule update process** mentioned
- [ ] **Where to update** (.cursor/rules/, CLAUDE.md)

#### Allowed Deviations

- [ ] **Minor formatting** - Understood as acceptable
- [ ] **Whitespace edits** - Allowed without review
- [ ] **Single-line refactors** - Within scope and type-checked

### Phase 4: Task Sizing Analysis

Review against embedded task sizing guidelines:

#### Duration Compliance

Generate report:

```yaml
task_sizing_report:
  total_tasks: [count]
  by_duration:
    too_small:  # < 30m
      - task_id: [id]
        estimate_minutes: [n]
        rationale: [why small]
        recommendation: [merge or accept]
    optimal:    # 30-150m
      count: [n]
      percentage: [%]
    too_large:  # > 150m
      - task_id: [id]
        estimate_minutes: [n]
        recommendation: [split into X, Y, Z]
```

#### File Scope Analysis

- [ ] **1-3 files** preferred
- [ ] **>5 files** justified or split
- [ ] **Explicit file lists** in each task
- [ ] **Touch-only files** clearly marked

#### Task Decomposition Quality

- [ ] **Smallest useful deliverable** defined
- [ ] **Clear acceptance test** per task
- [ ] **Example files provided**
- [ ] **Commit after each task** strategy

#### Large Task Detection

Identify tasks requiring decomposition:

```yaml
decomposition_needed:
  - task_id: [id]
    current_estimate: [minutes]
    suggested_split:
      - name: [subtask 1]
        estimate: [minutes]
      - name: [subtask 2]
        estimate: [minutes]
      - name: [subtask 3]
        estimate: [minutes]
```

### Phase 5: Completeness Check

#### Milestone Structure

- [ ] All milestones have unique IDs
- [ ] Names are clear and descriptive
- [ ] Descriptions explain deliverables
- [ ] Dependencies correctly ordered
- [ ] No circular dependencies
- [ ] Estimated durations realistic
- [ ] Task files referenced correctly
- [ ] Success criteria testable

#### Task Breakdown

- [ ] All tasks have unique IDs
- [ ] Task names descriptive
- [ ] Descriptions clear and actionable
- [ ] Estimates follow sizing rules
- [ ] Types specified (code/test/docs/config)
- [ ] Dependencies explicit and correct
- [ ] File lists complete and accurate
- [ ] Instructions detailed and clear

#### Task Quality

- [ ] Objectives clearly stated
- [ ] Implementation steps numbered
- [ ] Constraints explicit
- [ ] TDD checklists included (code tasks)
- [ ] Validation commands provided
- [ ] Expected outputs documented
- [ ] Drift policy stated

### Phase 6: Alignment Check

#### Business Requirements (if provided)

- [ ] All functional requirements mapped to tasks
- [ ] Priority aligns with business priorities
- [ ] MVP scope clearly defined
- [ ] Success criteria can verify business goals

Generate coverage matrix:

```yaml
business_requirement_coverage:
  FR-1: [task-ids]
  FR-2: [task-ids]
  FR-3: [gap]  # Not covered
```

#### Technical Requirements (if provided)

- [ ] Architecture decisions reflected
- [ ] Technology choices enforced
- [ ] Testing strategy implemented
- [ ] Security requirements addressed
- [ ] Performance requirements considered

Generate coverage matrix:

```yaml
technical_requirement_coverage:
  architecture:
    - decision: [description]
      enforced_in: [task-ids]
  technology:
    - choice: [description]
      enforced_in: [task-ids]
```

### Phase 7: Dependency Analysis

#### Critical Path

- [ ] Critical path identified
- [ ] Duration calculated
- [ ] Parallel opportunities noted
- [ ] Unnecessary dependencies removed
- [ ] Dependencies minimal but sufficient

Generate dependency graph:

```yaml
dependency_analysis:
  critical_path:
    - [milestone-id]
    - [milestone-id]
  critical_path_duration: [time]
  
  parallel_opportunities:
    - can_parallelize: [[m1, m2], [m3, m4]]
      time_saved: [duration]
  
  dependency_issues:
    - task: [id]
      issue: [description]
      recommendation: [fix]
```

#### Circular Dependency Check

- [ ] No circular dependencies in milestones
- [ ] No circular dependencies in tasks
- [ ] Dependency graph is a DAG

### Phase 8: Gap Identification

#### Common Gaps

- [ ] Infrastructure tasks present (setup, tooling)
- [ ] Test tasks included
- [ ] Documentation tasks included
- [ ] Error handling tasks included
- [ ] Configuration tasks included
- [ ] Deployment/release tasks included
- [ ] Assumptions documented
- [ ] Style anchors for new patterns
- [ ] Clear file boundaries
- [ ] Integration tasks between components

Generate gap report:

```yaml
gaps:
  missing_task_types:
    - type: [infrastructure/tests/docs/etc]
      importance: [high/medium/low]
      recommendation: [description]
  
  missing_requirements_coverage:
    - requirement: [id]
      category: [functional/non-functional]
      impact: [high/medium/low]
  
  undocumented_assumptions:
    - task: [id]
      assumption: [description]
      recommendation: [document explicitly]
```

#### Wireframe Coverage (Soft Gate)

If any tasks reference `.tsx`/`.jsx`/`.vue`/`.svelte` files or mention UI components (forms, tables, navigation, modals, pages, layouts):

- [ ] Does `ux/wireframe-spec.yaml` exist?
- [ ] Does every page with UI tasks have a wireframe entry?
- [ ] Are all detected components represented in the wireframe spec?
- [ ] Are user flows documented for key interactions?

**This is a WARN-level gate (not CRIT).** It does NOT block progression.

If wireframes are missing or incomplete, add to the review output:

```yaml
wireframe_coverage:
  ui_tasks_detected: [count]
  wireframe_spec_exists: [true/false]
  missing_pages:
    - page: [name]
      tasks: [task-ids]
  recommendation: "Consider running Step 6 (UX/Wireframe Planning) before development"
```

User sees:
> "WARN-001: [n] UI tasks detected without wireframe coverage. Consider running Step 6 before development. Proceed anyway? (yes/no)"

### Phase 9: Style Anchor Validation

- [ ] Anchors reference existing files (if repository available)
- [ ] Line numbers accurate (if verifiable)
- [ ] Patterns demonstrated correctly
- [ ] Descriptions helpful
- [ ] Sufficient anchors for each new pattern
- [ ] Test anchors included
- [ ] README anchors included where applicable

### Phase 10: Quality Gate Validation

- [ ] Linter commands specified — **AI: explicit**, **Human/Hybrid: general**
- [ ] Type checker commands specified — **AI: explicit**, **Human/Hybrid: general**
- [ ] Test commands specified — **AI: explicit**, **Human/Hybrid: general**
- [ ] Commands are executable (where specified)
- [ ] Expected outputs defined — **AI only**
- [ ] Failure handling documented — **AI only**

For Human/Hybrid audiences, verify success criteria mention running tests/lint/typecheck without requiring explicit command text.

## Review Output

Generate comprehensive review report as `implementation-plan-review.yaml`.

The output document includes: `metadata` (plan files, review date), `overall_scores` (structure, best practices, task sizing, completeness, alignment, development readiness — each 1-10), `critical_issues`, `high_priority_issues`, `medium_priority_issues`, `best_practices_violations` (by category), `gaps`, `strong_areas`, `optimization_opportunities`, `specific_recommendations`, and `readiness_assessment`.

See **[references/output-spec.md](references/output-spec.md)** for the complete document specification with all fields, issue IDs (CRIT-NNN/WARN-NNN/INFO-NNN), and scoring criteria.

See **[references/example.yaml](references/example.yaml)** for a full example.

## Usage

Review an implementation plan:

```
/implementation-plan-review path/to/milestones.yaml
```

The skill will:

1. Load all milestone and task files
2. Validate structure and schema
3. Check compliance against all best practices
4. Analyze task sizing and dependencies
5. Identify gaps and issues
6. Generate comprehensive review report
7. Provide specific recommendations

## Output Files

Generates:

- `implementation-plan-review.yaml` - Comprehensive review report
- `task-sizing-analysis.yaml` - Detailed task sizing breakdown
- `requirement-coverage.yaml` - Requirements to tasks mapping
- `dependency-graph.yaml` - Milestone and task dependencies

## Best Practice References

This skill embeds and enforces best practices directly:

### 1. Implementation Plan Best Practices

**Core Principle:**
> Models optimize locally; enforce global constraints with layered verification (prompt → IDE → commit → CI → runtime).

**Key Practices:**
- **Style Anchors:** Always include 2-3 exemplary files as templates with exact paths and line numbers. Prefer concrete repository examples (code + tests + README). Enforce anchors early to prevent architectural drift.
- **Task Sizing:** Split work into 30m–2.5h atomic tasks (30–150 minutes optimal). Limit scope to specific files. Commit after each small task. Revert immediately on drift. If a task is shorter than 30m, either increase estimate or split it with rationale.
- **Affirmative Instructions:** State permitted actions explicitly (e.g., "ONLY use: X, Y, Z"). Avoid negative framing.
- **Tiered Rules:** Global (user prefs), Project (persistent in CLAUDE.md or .cursor/rules/), Context-aware (per directory/file).
- **TDD as Anchor:** Require TDD checklist before implementation (tests → minimal code → more tests → refactor). When tests fail, return failing output with instruction: "Revise implementation to pass this test while keeping all previously passing tests. Do not modify the test. Do not add dependencies."
- **Drift Handling:** Stop and revert immediately on unexpected dependencies or unfamiliar patterns. Do not fix mid-stream. Document learnings and update persistent rules after each session.
- **Prompt Positioning:** Put critical specs, style anchors, and hard rules at the beginning and reiterate at the end of prompts (avoid burying requirements in the middle).
- **External Data Validation:** Never use type assertions on external data. Validate all external inputs with proper error handling and validation.

**IDE/Linting:**
- Enforce strict linting (go vet, golangci-lint, gofmt)
- Run tests with race detection
- Zero warnings policy

**Quality Gates:**
- Pre-commit: make lint and make test with zero warnings
- CI: Count violations and fail if thresholds exceeded

### 2. Drift Policy

**Purpose:**
Define when to stop, revert, and document when the model's edits deviate from project rules.

**Stop & Revert Criteria:**
- Model introduces new dependencies not listed in allowed stack
- Edits touch files outside specified targets (>3 unexpected files)
- Linting or type errors introduced that cannot be resolved within task scope
- Tests fail and model proposes changing tests to pass

**Immediate Actions:**
1. Stop the model session and return clear error message summarizing deviation
2. Revert workspace to state before task started (use git where appropriate)
3. Create incident note in `docs/drift-incidents/` with: what happened, files changed, new dependencies, remediation steps

**Recording Learnings:**
- After resolving, update `.cursor/rules/` or `CLAUDE.md` with new rules to prevent recurrence

**Allowed Deviations:**
- Minor formatting changes (editor config) or whitespace-only edits
- Single-line refactors within targeted files if within scope and type-checked

**Review & Approval:**
- Any revert or incident note must be reviewed by human maintainer before re-running

### 3. Task Sizing Guidance

**Purpose:**
Keep model-directed work in predictable, reviewable chunks to reduce drift and unexpected scope growth.

**Guidelines:**
- Target task duration: 30 minutes to 2.5 hours
- Prefer changes limited to 1-3 files where possible
- If a requested change touches >5 files or will take >2.5 hours, split into smaller tasks

**Process:**
1. Define smallest useful deliverable and clear acceptance test
2. Provide example files and exact paths to edit
3. After each completed task, run tests and commit with clear message

**Breaking Down Large Tasks:**
- Decompose into: (a) tests + scaffolding, (b) minimal implementation, (c) refactor & polish
- Create plan note listing sub-tasks and acceptance criteria

**Examples:**
- Small: fix a bug in `src/utils/parse.ts` — 30-60 mins
- Medium: add new API endpoint `src/server/user.ts` with tests — 1-2.5 hours
- Large: migrate auth system — split into design + incremental PRs

## Decision Support

After review, provide recommendations:

### If Critical Issues Found

> "I've identified **[n] critical issues** that block development:
>
> 1. [Critical issue 1]
> 2. [Critical issue 2]
>
> **Recommendation:** Fix these issues before starting development.
>
> Would you like to:
> 1. Fix issues now (I'll regenerate affected tasks)
> 2. Review issues manually
> 3. Proceed with awareness (not recommended)"

### If High Priority Issues Found

> "I've identified **[n] high-priority issues** that should be addressed:
>
> 1. [Issue 1]
> 2. [Issue 2]
>
> **Recommendation:** Address these before development or early in milestone 0.
>
> Would you like to:
> 1. Address now (I'll update the plan)
> 2. Note for milestone 0
> 3. Proceed and handle as needed"

### If Ready with Modifications

> "The plan is **mostly ready** with [n] recommended improvements.
>
> **Strong areas:**
> - [What's well-planned]
>
> **Recommended improvements:**
> - [Improvement 1]
> - [Improvement 2]
>
> **Timeline impact:** [estimate]
>
> Would you like to:
> 1. Apply improvements now
> 2. Note for implementation
> 3. Start development as-is"

### If Ready for Development

> "The implementation plan is **ready for development**!
>
> **Strengths:**
> - [What's excellent]
> - [Best practices followed]
>
> **Minor optimization opportunities:**
> - [Opportunity 1]
> - [Opportunity 2]
>
> **Estimated timeline:** [duration]
> **Critical path:** [duration]
>
> You can begin development with confidence."

## Integration

This skill integrates with:

- **implementation-planner** - Reviews plans generated by this skill
- **business-requirements-interview** - Validates alignment with business needs
- **technical-requirements-interview** - Validates technical specification coverage

## Examples

See **[references/example.yaml](references/example.yaml)** for a complete sample review output.
