# 🐙 Git & GitHub Reference Guide

A simple, practical guide on how to work with Git, GitHub, branches, and merging.

---

## 🏁 1. The Core Git Lifecycle
```
  [ Working Directory ] ───git add───> [ Staging Area ] ───git commit───> [ Local Repository (.git) ] ───git push───> [ GitHub (Remote) ]
```

---

## 🌿 2. Working with Branches

Branches allow you to develop features or fix bugs in an isolated environment without affecting the stable `main` branch.

### Create a New Branch
Always create a new branch for each new feature or task:
```bash
# Get the latest changes from GitHub first
git checkout main
git pull origin main

# Create and switch to your new branch
git checkout -b feature/my-cool-feature
```

### Check Your Current Branch
```bash
git branch
```

### Switch Between Existing Branches
```bash
git checkout main
# or
git checkout feature/my-cool-feature
```

---

## 💾 3. Saving and Pushing Your Changes

When you have made changes and want to save them and send them to GitHub:

### Step 1: Check Status
See what files have been changed or added:
```bash
git status
```

### Step 2: Stage the Changes (Add)
Choose which changes you want to include in your next save point (commit):
```bash
# Add a specific file
git add src/components/ui/markdown/SectionComponent.tsx

# Or, add all changed files in the project
git add .
```

### Step 3: Commit (Save Locally)
Save your staged changes to your local database with a descriptive message:
```bash
git commit -m "feat: improve collapsible heading chevron click area and mobile view"
```

### Step 4: Push (Upload to GitHub)
Upload your local branch and commits to GitHub:
```bash
# The first time you push a new branch:
git push -u origin feature/my-cool-feature

# For any subsequent pushes to the same branch:
git push
```

---

## 🔀 4. Merging & Handling Pull Requests

When your feature is complete, you want to merge it back into the stable `main` branch.

### Option A: Via GitHub Pull Request (Recommended)
1. Go to your repository on **GitHub.com**.
2. Click **Compare & pull request** next to your recently pushed branch.
3. Add a description, click **Create pull request**.
4. Once tests pass and code is reviewed, click **Merge pull request** on GitHub.
5. In your terminal, pull the merged changes back down:
   ```bash
   git checkout main
   git pull origin main
   ```

### Option B: Local Merge (Command Line)
If you want to merge your feature branch into `main` directly on your machine:
```bash
# 1. Switch to main
git checkout main

# 2. Get latest main changes from GitHub
git pull origin main

# 3. Merge your feature branch into main
git merge feature/my-cool-feature

# 4. Push the merged main branch back to GitHub
git push origin main

# 5. Delete the local feature branch (optional)
git branch -d feature/my-cool-feature
```

---

## ⚠️ 5. Resolving Merge Conflicts

A conflict happens when two people (or you and the remote branch) edited the **same lines of the same file** differently. Git doesn't know which version is correct and will ask you to decide.

### How to resolve conflicts:
1. Git will tell you which files have conflicts. Open those files.
2. You will see markers like this:
   ```markdown
   <<<<<<< HEAD
   This is the version on the main branch (or the branch you are merging into).
   =======
   This is the version on your feature branch.
   >>>>>>> feature/my-cool-feature
   ```
3. Edit the file to delete the conflict markers (`<<<<<<<`, `=======`, `>>>>>>>`) and keep the correct combination of code.
4. Stage and commit the resolved changes:
   ```bash
   git add filename.tsx
   git commit -m "chore: resolve merge conflict"
   git push
   ```

---

## 🛠️ 6. Quick Cheat Sheet

| Command | What it does |
|---|---|
| `git status` | Shows modified files, staged files, and current branch. |
| `git log --oneline` | Shows a clean, abbreviated history of commits. |
| `git diff` | Shows exact line changes not yet staged. |
| `git checkout -b <name>` | Creates and switches to a new branch. |
| `git checkout <name>` | Switches to an existing branch. |
| `git add <file>` | Stages changes for the next commit. |
| `git commit -m "<msg>"` | Saves staged changes locally. |
| `git push` | Uploads changes to GitHub. |
| `git pull` | Downloads latest changes from GitHub and merges them. |
| `git merge <branch>` | Merges specified branch into current branch. |
