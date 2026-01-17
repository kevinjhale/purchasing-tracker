# Agent Configurations

Custom agents for development workflow. Each agent has a specific purpose, model assignment, and trigger conditions.

## Quick Reference

| Agent | Model | Purpose | Trigger |
|-------|-------|---------|---------|
| [architect](./architect.md) | Opus | System design & planning | Before non-trivial features |
| [code-reviewer](./code-reviewer.md) | Sonnet | Quality & anti-pattern check | After implementation |
| [test-writer](./test-writer.md) | Sonnet | Test generation | After review passes |
| [a11y-auditor](./a11y-auditor.md) | Haiku | WCAG 2.1 AA compliance | After UI changes |
| [sql-writer](./sql-writer.md) | Sonnet | Database & migrations | Data layer work |
| [refactor-planner](./refactor-planner.md) | Opus | Tech debt analysis | On request / periodic |
| [api-designer](./api-designer.md) | Sonnet | REST API design | New endpoints |
| [commit-preparer](./commit-preparer.md) | Haiku | Atomic commit prep | Before committing |

## Model Strategy

```
Opus ($$$$)     → High-stakes decisions: architect, refactor-planner
Sonnet ($$$)    → Balanced quality/cost: code-reviewer, test-writer, sql-writer, api-designer
Haiku ($$)      → Checklist/validation: a11y-auditor, commit-preparer
```

## Workflow

```
┌─────────────────────────────────────────────────────────────┐
│                     FEATURE DEVELOPMENT                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. PLAN                                                     │
│     └── [architect] ──────────────────────────── Opus       │
│                                                              │
│  2. IMPLEMENT                                                │
│     └── [sql-writer] (if DB work) ────────────── Sonnet     │
│     └── [api-designer] (if API work) ─────────── Sonnet     │
│                                                              │
│  3. REVIEW                                                   │
│     └── [code-reviewer] ──────────────────────── Sonnet     │
│     └── [a11y-auditor] (if UI work) ──────────── Haiku      │
│                                                              │
│  4. TEST                                                     │
│     └── [test-writer] ────────────────────────── Sonnet     │
│                                                              │
│  5. COMMIT                                                   │
│     └── [commit-preparer] ────────────────────── Haiku      │
│                                                              │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                     MAINTENANCE                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  [refactor-planner] ──────────────────────────── Opus       │
│     └── Periodic health checks                               │
│     └── After code-reviewer finds patterns                   │
│     └── Before major changes                                 │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Dynamic Model Upgrades

Some agents upgrade to a higher model for complex scenarios:

**a11y-auditor:** Haiku → Sonnet
- Complex interactive components
- Custom widgets with ARIA
- Dynamic content accessibility

**commit-preparer:** Haiku → Sonnet
- Changes span 5+ files
- Breaking changes involved
- Critical path modifications

**code-reviewer:** Sonnet → Opus
- Security-critical code
- Authentication/authorization
- Payment/financial logic
- Cryptographic implementations

## Usage Examples

```bash
# Invoke specific agent
claude "Run the architect agent for this feature"
claude "Use code-reviewer on the changes I just made"
claude "Run a11y-auditor on the new modal component"

# Workflow commands
claude "I'm done implementing, run the full review workflow"
claude "Prepare commits for my changes"
```

## Customization

Each agent config includes:
- **Model**: Default model assignment
- **Model Upgrade**: When to use a higher model
- **Instructions**: Detailed prompts and guidelines
- **Output Format**: Expected response structure
- **What NOT to Do**: Common mistakes to avoid

Modify individual agent files to adjust behavior for your specific needs.
