# Implementation Plan Best Practices

**Skill for preventing drift in AI-assisted implementation plans**

## Overview

This skill teaches proven best practices for creating implementation plans that:
- Prevent architectural and implementation drift
- Maintain consistency with project standards
- Ensure predictable, reviewable outcomes
- Minimize errors and rework

## Core Principle

> Models optimize locally; enforce global constraints with layered verification (prompt → IDE → commit → CI → runtime).

## Key Practices

1. **Style Anchors** - 2-3 concrete code examples per task
2. **Task Sizing** - 30-150 minute atomic tasks
3. **TDD Requirements** - Test-first with explicit validation
4. **Affirmative Instructions** - "ONLY use" instead of "don't use"
5. **Drift Prevention** - Stop criteria and revert process
6. **Quality Gates** - Lint, test, typecheck at every step
7. **Prompt Positioning** - Critical rules at beginning and end
8. **Layered Verification** - Multiple checkpoints from prompt to runtime

## Quick Start

### When Creating Plans

Use the **Complete Task Template** from SKILL.md:

```yaml
task:
  id: t-xxx-001
  name: "Clear, specific task name"
  estimate_minutes: 60-90
  files:
    touch_only: [explicit file list]
    modify_only: [explicit file list]
  style_anchors:
    - path: src/example.ts
      lines: 10-45
      description: "Pattern to follow"
  # ... (see SKILL.md for full template)
```

### When Reviewing Plans

Check against the **Quick Reference Checklist** in SKILL.md:

- [ ] 2-3 style anchors per task
- [ ] Duration 30-150 minutes
- [ ] 1-3 files per task
- [ ] TDD checklist included
- [ ] Affirmative instructions
- [ ] Drift policy stated
- [ ] Validation commands provided
- [ ] Critical rules at beginning and end

### When Improving Plans

Identify **Anti-Patterns** and apply fixes:

| Anti-Pattern | Fix |
|--------------|-----|
| No style anchors | Add 2-3 concrete examples with line numbers |
| Tasks too large | Split into tests + implementation + refactor |
| Negative framing | Change to "ONLY use: X, Y, Z" |
| Burying rules | Move to beginning AND end |
| No validation | Add explicit lint/test/typecheck commands |

## Examples

- **well-structured-task.md** - Complete example with all best practices
- **before-after-improvements.md** - How to transform a poor task into great ones

## Integration

This skill works with:
- **implementation-planner** - Apply when generating plans
- **implementation-plan-review** - Validate against these practices
- **business-requirements-interview** - Ensure alignment
- **technical-requirements-interview** - Technical specification

## Key Insight

**Prevention > Correction**

Well-structured plans with clear constraints, anchors, and checkpoints prevent drift before it starts. The cost of planning properly is far less than the cost of fixing drifted implementations.

## Further Reading

- SKILL.md - Complete guide with all practices
- examples/ - Concrete examples and transformations
