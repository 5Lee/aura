# Aura Agent Harness Guide

This guide explains how to work with the Aura project using Anthropic's long-running agent best practices.

## System Architecture

Based on [Effective harnesses for long-running agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents), this project uses a two-agent system:

### 1. Initializer Agent (First Session)
Sets up the initial environment:
- Creates `feature_list.json` with all required features
- Creates `CLAUDE_PROGRESS.md` for tracking
- Creates `init.sh` for starting the dev server
- Makes initial git commit

### 2. Coding Agent (Subsequent Sessions)
Makes incremental progress:
- Reads progress files to get context
- Works on ONE feature at a time
- Tests thoroughly before marking complete
- Commits changes with descriptive messages
- Updates progress files

---

## Critical Rules

### 🚫 NEVER DO:
- **NEVER remove features** from `feature_list.json`
- **NEVER edit feature descriptions** - only change `"passes": true/false`
- **NEVER mark features as passing without end-to-end testing**
- **NEVER work on multiple features in one session**
- **NEVER leave the codebase in a broken state**

### ✅ ALWAYS DO:
- **ALWAYS read** `CLAUDE_PROGRESS.md` at session start
- **ALWAYS read** `feature_list.json` before picking a feature
- **ALWAYS test** features as a real user would
- **ALWAYS commit** changes with descriptive messages
- **ALWAYS update** `CLAUDE_PROGRESS.md` after each session
- **ALWAYS run** `init.sh` to start the dev server

---

## Session Workflow

### Step 1: Get Your Bearings
```bash
pwd                          # Check current directory
git log --oneline -20        # Check recent commits
cat CLAUDE_PROGRESS.md       # Read progress log
cat feature_list.json        # Check feature status
```

### Step 2: Start the Server
```bash
./init.sh    # This handles everything: deps, migrations, server start
```

### Step 3: Verify Baseline
Before implementing new features, verify existing functionality works:
- Login with demo account (demo@aura.ai / demo123456)
- Check dashboard loads
- Verify basic prompt creation works

### Step 4: Pick a Feature
Choose the **highest priority** feature with `"passes": false`:
- Priority 1: Core functionality (auth, basic CRUD)
- Priority 2: Important features (editing, favorites)
- Priority 3: Nice-to-have (search, dark mode)

### Step 5: Implement and Test
1. Implement the feature
2. **Test as a real user** - click through the UI
3. Fix any bugs found
4. **Retest** until it works perfectly

### Step 6: Update and Commit
```bash
# Mark feature as complete in feature_list.json
# Update CLAUDE_PROGRESS.md
git add .
git commit -m "feat: implement [feature-id] - [brief description]"
```

---

## Feature List Format

Each feature in `feature_list.json`:
```json
{
  "id": "auth-001",
  "category": "authentication",
  "priority": 1,
  "description": "User can register a new account",
  "steps": ["Step 1", "Step 2", ...],
  "passes": false    // ONLY change this field!
}
```

---

## Testing Guidelines

### ✅ Good Testing:
- Open browser and click through UI
- Test success cases AND error cases
- Test with different user roles
- Verify database state changes

### ❌ Bad Testing:
- Only reading the code
- Only checking for syntax errors
- Assuming it works without verification

---

## Progress File Template

When updating `CLAUDE_PROGRESS.md`:

```markdown
### [DATE] - [Feature ID] [Feature Name]
**Agent**: [Your Name]
**Feature**: [id] - [description]

**What I Did**:
- [List changes made]

**Testing Performed**:
- [List test steps executed]
- [All steps passed ✅]

**Files Modified**:
- `path/to/file1.ts` - [change description]
- `path/to/file2.tsx` - [change description]

**Status**: ✅ COMPLETE / ⚠️ NEEDS WORK
```

---

## Quick Reference

| Command | Purpose |
|---------|---------|
| `./init.sh` | Start dev server (handles migrations) |
| `npm run dev` | Start Next.js dev server |
| `npx prisma studio` | Open database GUI |
| `npx prisma migrate dev` | Create/apply migrations |
| `npx prisma db seed` | Seed database |

| File | Purpose |
|------|---------|
| `feature_list.json` | Master feature checklist |
| `CLAUDE_PROGRESS.md` | Session history and notes |
| `init.sh` | Dev server startup script |
| `.env` | Database and auth configuration |

---

## Troubleshooting

### Server won't start?
```bash
# Check if .env exists
ls -la .env

# Regenerate Prisma client
npx prisma generate

# Reset database (CAUTION: deletes data)
npx prisma migrate reset
```

### Database errors?
```bash
# Check connection string in .env
cat .env | grep DATABASE_URL

# Test MySQL connection
mysql -u root -p -e "SHOW DATABASES;"
```

### Port 3000 in use?
```bash
# Find and kill process
lsof -ti:3000 | xargs kill -9
```

---

## Sources

- [Effective harnesses for long-running agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents) - Anthropic Engineering Blog
